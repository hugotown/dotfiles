// Orchestrates ONE investigator sub-pi: builds the prompt, spawns pi with
// --tools curl, captures the final assistant text, extracts the FINDINGS:
// section, and returns a Finding record with status/text/duration. Errors
// degrade gracefully — synthesis proceeds even if some investigators fail.
import { type DepthProfile, type Finding } from "../types.ts";
import { buildInvestigatorSystemPrompt, extractFindings } from "./prompt-builder.ts";
import { spawnPi } from "./spawn-pi.ts";

export interface InvestigatorInput {
  originalPregunta: string;
  subQuestion: string;
  cutoffDate: string | null;
  profile: DepthProfile;
  cwd: string;
  maxTextKb: number;
  signal?: AbortSignal;
}

function clipText(text: string, maxKb: number): string {
  const maxBytes = maxKb * 1024;
  const buf = Buffer.from(text, "utf-8");
  if (buf.byteLength <= maxBytes) return text;
  return new TextDecoder("utf-8", { fatal: false }).decode(buf.subarray(0, maxBytes)) + "\n\n[truncated]";
}

export async function runInvestigator(input: InvestigatorInput): Promise<Finding> {
  const start = Date.now();
  const systemPrompt = buildInvestigatorSystemPrompt({
    originalPregunta: input.originalPregunta,
    subQuestion: input.subQuestion,
    cutoffDate: input.cutoffDate,
    maxCurls: input.profile.curls_per_subpi,
  });
  const userMessage = `Answer the sub-question. End with a FINDINGS: section.`;
  const result = await spawnPi({
    role: input.profile.investigator,
    thinking: input.profile.thinking,
    tools: ["curl"], // ONLY curl — no bash, no read/write, nothing else
    systemPrompt,
    userMessage,
    cwd: input.cwd,
    timeoutMs: input.profile.subpi_timeout_ms,
    signal: input.signal,
  });
  const durationMs = Date.now() - start;

  if (result.timedOut) {
    return { subQuestion: input.subQuestion, status: "timeout", text: "[ERROR: sub-pi timed out]", durationMs, exitCode: result.exitCode };
  }
  if (result.exitCode !== 0) {
    return {
      subQuestion: input.subQuestion,
      status: "error",
      text: `[ERROR: sub-pi exit ${result.exitCode}]`,
      errorMessage: result.stderr.slice(0, 500),
      durationMs,
      exitCode: result.exitCode,
    };
  }
  const findings = extractFindings(result.finalText);
  if (!findings) {
    return {
      subQuestion: input.subQuestion,
      status: "missing_findings",
      text: `[Sub-pi did not emit FINDINGS:. Last assistant text:\n\n${clipText(result.finalText, input.maxTextKb)}]`,
      durationMs,
      exitCode: 0,
    };
  }
  return { subQuestion: input.subQuestion, status: "ok", text: clipText(findings, input.maxTextKb), durationMs, exitCode: 0 };
}
