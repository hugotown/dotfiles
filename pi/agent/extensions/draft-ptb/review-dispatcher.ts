// Dispatcher for the LLM_REVIEW phase.
//
// Three reviewer subagents run in parallel as child `pi` processes (same approach
// as parallel-dispatcher.ts in M3). Each subagent uses a DIFFERENT model per the
// contract:
//   - contracts → claude-opus-4.6
//   - quality   → gpt-5.4
//   - tests     → gemini-3.1-pro-preview
//
// Output contract: each reviewer's final assistant text is the JSON returned by
// its review-submission tool (a single JSON object matching ReviewDimensionResult).
// We parse it here and aggregate into ReviewResults.
//
// We dispatch directly (not via the `subagent` tool) to mirror M3's pattern and
// because the `subagent` tool would need a controller LLM turn to drive it.

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { DraftState, ReviewDimensionResult, ReviewResults, ReviewIssue } from "./state.ts";
import { buildReviewContractsPrompt } from "./prompts/review-contracts.ts";
import { buildReviewQualityPrompt } from "./prompts/review-quality.ts";
import { buildReviewTestsPrompt } from "./prompts/review-tests.ts";

interface ReviewerSpec {
  dimension: "contracts" | "quality" | "tests";
  provider: string;
  model: string;
  systemPrompt: string;
  /** Tool the reviewer is expected to call. We pass it as the tool allowlist plus `read` and `bash`. */
  submitTool: string;
}

// Read + bash are read-only here (no write/edit allowed). The submit tool is the only
// extension tool the reviewer needs.
const REVIEWER_TOOLS = ["read", "bash"];

function getPiInvocation(args: string[]): { command: string; args: string[] } {
  const currentScript = process.argv[1];
  const isBunVirtualScript = currentScript?.startsWith("/$bunfs/root/");
  if (currentScript && !isBunVirtualScript && fs.existsSync(currentScript)) {
    return { command: process.execPath, args: [currentScript, ...args] };
  }
  const execName = path.basename(process.execPath).toLowerCase();
  const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
  return isGenericRuntime ? { command: "pi", args } : { command: process.execPath, args };
}

async function writeSystemPromptFile(name: string, prompt: string): Promise<{ dir: string; file: string }> {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "draft-ptb-review-"));
  const safe = name.replace(/[^\w.-]+/g, "_");
  const file = path.join(dir, `system-${safe}.md`);
  await fs.promises.writeFile(file, prompt, { encoding: "utf-8", mode: 0o600 });
  return { dir, file };
}

function cleanup(dir: string | null, file: string | null): void {
  if (file) { try { fs.unlinkSync(file); } catch { /* ignore */ } }
  if (dir) { try { fs.rmdirSync(dir); } catch { /* ignore */ } }
}

interface SpawnResult {
  exitCode: number;
  finalText: string;
  stderr: string;
}

async function runReviewer(spec: ReviewerSpec, cwd: string): Promise<SpawnResult> {
  const { dir, file } = await writeSystemPromptFile(spec.dimension, spec.systemPrompt);
  try {
    const tools = [spec.submitTool, ...REVIEWER_TOOLS];
    const args = [
      "--mode", "json",
      "-p",
      "--no-session",
      "--provider", spec.provider,
      "--model", spec.model,
      "--thinking", "high",
      "--tools", tools.join(","),
      "--append-system-prompt", file,
      `Review the ${spec.dimension} dimension and emit the verdict by calling \`${spec.submitTool}\`.`,
    ];
    const { command, args: cmdArgs } = getPiInvocation(args);

    return await new Promise<SpawnResult>((resolve) => {
      const proc = spawn(command, cmdArgs, { cwd, shell: false, stdio: ["ignore", "pipe", "pipe"] });
      let buf = "";
      let stderr = "";
      let finalText = "";
      const onLine = (line: string) => {
        if (!line.trim()) return;
        let event: {
          type?: string;
          message?: { role?: string; content?: Array<{ type?: string; text?: string }> };
        };
        try { event = JSON.parse(line); } catch { return; }
        if (event.type !== "message_end" || !event.message || event.message.role !== "assistant") return;
        for (const part of event.message.content ?? []) {
          if (part.type === "text" && typeof part.text === "string") finalText = part.text;
        }
      };
      proc.stdout.on("data", (data) => {
        buf += data.toString();
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) onLine(line);
      });
      proc.stderr.on("data", (data) => { stderr += data.toString(); });
      proc.on("close", (code) => {
        if (buf.trim()) onLine(buf);
        resolve({ exitCode: code ?? 0, finalText, stderr });
      });
      proc.on("error", (err) => resolve({ exitCode: 1, finalText, stderr: stderr + String(err) }));
    });
  } finally {
    cleanup(dir, file);
  }
}

// ---------- JSON parsing ----------

/**
 * Parse a reviewer's final assistant text as a ReviewDimensionResult JSON object.
 *
 * Reviewers are instructed to emit JSON via the submit tool, whose execute() returns
 * `JSON.stringify(params)`. That text becomes the agent's final message. Some models
 * still wrap it in code fences or add a leading sentence; this parser extracts the
 * first balanced JSON object it can find.
 */
export function parseReviewVerdict(text: string, dimension: string): ReviewDimensionResult {
  const fallback = (reason: string): ReviewDimensionResult => ({
    approved: false,
    issues: [{
      severity: "critical",
      file: "(reviewer)",
      line: null,
      description: `${dimension} reviewer produced no parseable verdict: ${reason}`,
      fixSuggestion: "rerun the review — the reviewer subagent likely crashed or returned non-JSON",
    }],
  });

  const trimmed = text.trim();
  if (!trimmed) return fallback("empty output");

  // Strip code fences if present.
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : extractFirstJsonObject(trimmed);
  if (!candidate) return fallback("no JSON object found");

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch (e) {
    return fallback(`JSON.parse failed: ${(e as Error).message}`);
  }

  if (!isValidVerdict(parsed)) return fallback("JSON did not match ReviewDimensionResult shape");
  return parsed;
}

function extractFirstJsonObject(s: string): string | null {
  // Scan for a balanced { ... } at top level. Naive but enough — reviewers emit one object.
  const start = s.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function isValidVerdict(v: unknown): v is ReviewDimensionResult {
  if (!v || typeof v !== "object") return false;
  const obj = v as Record<string, unknown>;
  if (typeof obj.approved !== "boolean") return false;
  if (!Array.isArray(obj.issues)) return false;
  for (const issue of obj.issues) {
    if (!isValidIssue(issue)) return false;
  }
  return true;
}

function isValidIssue(v: unknown): v is ReviewIssue {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (o.severity !== "critical" && o.severity !== "important" && o.severity !== "minor") return false;
  if (typeof o.file !== "string") return false;
  if (o.line !== null && typeof o.line !== "number") return false;
  if (typeof o.description !== "string") return false;
  if (typeof o.fixSuggestion !== "string") return false;
  return true;
}

// ---------- public API ----------

export async function dispatchReview(
  state: DraftState,
  _pi: ExtensionAPI,
  ctx: ExtensionContext,
): Promise<ReviewResults> {
  const specs: ReviewerSpec[] = [
    {
      dimension: "contracts",
      provider: "github-copilot",
      model: "claude-opus-4.6",
      systemPrompt: buildReviewContractsPrompt(state),
      submitTool: "draft_ptb_review_contracts",
    },
    {
      dimension: "quality",
      provider: "github-copilot",
      model: "gpt-5.4",
      systemPrompt: buildReviewQualityPrompt(state),
      submitTool: "draft_ptb_review_quality",
    },
    {
      dimension: "tests",
      provider: "github-copilot",
      model: "gemini-3.1-pro-preview",
      systemPrompt: buildReviewTestsPrompt(state),
      submitTool: "draft_ptb_review_tests",
    },
  ];

  ctx.ui.notify(`🔍 Dispatch de 3 revisores en paralelo (contracts/quality/tests)...`, "info");

  const outcomes = await Promise.all(specs.map((s) => runReviewer(s, ctx.cwd)));

  const buildVerdict = (spec: ReviewerSpec, result: SpawnResult): ReviewDimensionResult => {
    if (result.exitCode !== 0) {
      return {
        approved: false,
        issues: [{
          severity: "critical",
          file: "(reviewer)",
          line: null,
          description: `${spec.dimension} reviewer process exited ${result.exitCode}: ${result.stderr.trim().slice(0, 400)}`,
          fixSuggestion: "rerun the review — the reviewer subagent failed to complete",
        }],
      };
    }
    return parseReviewVerdict(result.finalText, spec.dimension);
  };

  return {
    contracts: buildVerdict(specs[0], outcomes[0]),
    quality: buildVerdict(specs[1], outcomes[1]),
    tests: buildVerdict(specs[2], outcomes[2]),
  };
}
