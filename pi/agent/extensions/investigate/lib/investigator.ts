// Orchestrates ONE investigator sub-pi: builds the prompt, spawns pi with
// --tools curl, captures the final assistant text, extracts the FINDINGS:
// section, and returns a Finding record with status/text/duration.
//
// Failure handling:
//   - On timeout/non-zero exit we STILL try to extract partial FINDINGS from
//     whatever text the sub-pi managed to emit before being killed. If we get
//     something usable we return status="ok" with `partial: true`.
//   - On timeout (and ONLY timeout) we retry up to profile.investigator_max_retries
//     times, each retry using timeout * 1.5 to give the slow sub-pi room to breathe.
//   - Non-zero exit and missing_findings do NOT retry (they typically indicate
//     a deterministic upstream error, not a transient timeout).
import { type DepthProfile, type Finding } from "../types.ts";
import { buildInvestigatorSystemPrompt, extractFindings } from "./prompt-builder.ts";
import { spawnPi, type SpawnPiResult } from "./spawn-pi.ts";

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

/**
 * Decide what Finding to return based on a single sub-pi attempt outcome.
 * Pure function (no side effects) so it can be unit-tested.
 */
export function buildFindingFromResult(args: {
  subQuestion: string;
  result: SpawnPiResult;
  durationMs: number;
  maxTextKb: number;
  attempts: number;
}): Finding {
  const { subQuestion, result, durationMs, maxTextKb, attempts } = args;
  const partialFindings = extractFindings(result.finalText);

  // Happy path: clean exit + FINDINGS marker present.
  if (!result.timedOut && result.exitCode === 0 && partialFindings) {
    return { subQuestion, status: "ok", text: clipText(partialFindings, maxTextKb), durationMs, exitCode: 0, attempts };
  }

  // Timed out — recover partial FINDINGS if any.
  if (result.timedOut) {
    if (partialFindings) {
      return {
        subQuestion,
        status: "ok",
        text: clipText(`${partialFindings}\n\n[partial: sub-pi timed out after ${durationMs}ms]`, maxTextKb),
        durationMs,
        exitCode: result.exitCode,
        partial: true,
        attempts,
      };
    }
    const tail = result.finalText.trim().length > 0
      ? `\n\nLast assistant text before kill:\n${clipText(result.finalText, maxTextKb)}`
      : "";
    return {
      subQuestion,
      status: "timeout",
      text: `[ERROR: sub-pi timed out after ${durationMs}ms]${tail}`,
      errorMessage: result.stderr.slice(0, 500) || undefined,
      durationMs,
      exitCode: result.exitCode,
      attempts,
    };
  }

  // Non-zero exit — recover partial FINDINGS if any.
  if (result.exitCode !== 0) {
    if (partialFindings) {
      return {
        subQuestion,
        status: "ok",
        text: clipText(`${partialFindings}\n\n[partial: sub-pi exit ${result.exitCode}]`, maxTextKb),
        durationMs,
        exitCode: result.exitCode,
        partial: true,
        attempts,
      };
    }
    return {
      subQuestion,
      status: "error",
      text: `[ERROR: sub-pi exit ${result.exitCode}]`,
      errorMessage: result.stderr.slice(0, 500) || undefined,
      durationMs,
      exitCode: result.exitCode,
      attempts,
    };
  }

  // Clean exit but no FINDINGS marker.
  return {
    subQuestion,
    status: "missing_findings",
    text: `[Sub-pi did not emit FINDINGS:. Last assistant text:\n\n${clipText(result.finalText, maxTextKb)}]`,
    durationMs,
    exitCode: 0,
    attempts,
  };
}

export async function runInvestigator(input: InvestigatorInput): Promise<Finding> {
  const systemPrompt = buildInvestigatorSystemPrompt({
    originalPregunta: input.originalPregunta,
    subQuestion: input.subQuestion,
    cutoffDate: input.cutoffDate,
    maxCurls: input.profile.curls_per_subpi,
  });
  const userMessage = `Answer the sub-question. End with a FINDINGS: section.`;

  const maxRetries = Math.max(0, input.profile.investigator_max_retries);
  let lastFinding: Finding | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (input.signal?.aborted) break;
    // Each retry gets 1.5x more time than the previous attempt to absorb
    // transient proxy/network slowness without changing the base config.
    const timeoutMs = Math.round(input.profile.subpi_timeout_ms * Math.pow(1.5, attempt));
    const start = Date.now();
    const result = await spawnPi({
      role: input.profile.investigator,
      thinking: input.profile.thinking,
      tools: ["curl"], // ONLY curl — no bash, no read/write, nothing else
      systemPrompt,
      userMessage,
      cwd: input.cwd,
      timeoutMs,
      signal: input.signal,
    });
    const durationMs = Date.now() - start;
    const finding = buildFindingFromResult({
      subQuestion: input.subQuestion,
      result,
      durationMs,
      maxTextKb: input.maxTextKb,
      attempts: attempt,
    });
    lastFinding = finding;
    // Retry on:
    //   - "timeout" (no partial recovered): transient slowness, worth more time.
    //   - "missing_findings": the model finished cleanly but forgot to emit the
    //     marker. Often a one-off LLM hiccup; a retry usually fixes it.
    // Do NOT retry on:
    //   - "ok" (anything): success, or partial we already accepted.
    //   - "error" (exit ≠ 0 with no partial): typically deterministic (auth,
    //     config). Retry would just burn budget.
    if (finding.status !== "timeout" && finding.status !== "missing_findings") break;
  }
  return lastFinding!;
}
