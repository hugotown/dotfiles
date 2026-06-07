// investigate — pi extension. Registers two surfaces:
//   1. `investigate` tool: research orchestrator (PLAN → parallel MAP → REDUCE).
//   2. `tool_call` interceptor on built-in `bash`: blocks external HTTP commands
//      so the LLM uses `curl` / `investigate` instead (proxy + SSRF enforced).
//
// Coupling with the `curl` extension is RUNTIME ONLY — never imported. Each
// investigator sub-pi spawns with `--tools curl`; if the curl extension is
// loaded in the same pi installation, the sub-pi exposes it. If not, the
// sub-pi fails fast at startup (captured as an error Finding, synthesis proceeds).
import type { AgentToolResult, AgentToolUpdateCallback, ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import { checkBashCommand } from "./lib/bash-guard.ts";
import { resolveDepth } from "./lib/depth-config.ts";
import { freshnessToDate } from "./lib/freshness.ts";
import { planSubQuestions } from "./lib/plan.ts";
import { runInvestigator } from "./lib/investigator.ts";
import { createSemaphore } from "./lib/semaphore.ts";
import { InvestigateParams } from "./lib/schema.ts";
import { getConfig } from "./lib/settings.ts";
import { synthesize } from "./lib/synthesize.ts";
import { type Finding, type InvestigateInput, MissingProxyEnvError } from "./types.ts";

const DESCRIPTION = [
  "Perform multi-source web research on a question and return a synthesized report (Markdown, Spanish).",
  "Internally: PLAN (split into N orthogonal sub-questions) → MAP (N sub-pi investigators in parallel, each with the `curl` tool) → REDUCE (one synthesis pass).",
  "Depth controls cost: light(~30s)/medium(~60s)/high(~2min)/deep(~5min).",
  "Use this for ANY broad research; for single HTTP requests use the `curl` tool directly.",
].join(" ");

const GUIDELINES = [
  "Pick the smallest depth that fits — deep is expensive. Use 'light' for a single fact, 'medium' for standard analysis, 'high' for broad research, 'deep' for thesis-grade work.",
  "The pregunta must be SPECIFIC. Bad: 'React'. Good: 'state management patterns for React 19 server components'.",
  "For single HTTP requests (one API call, one known URL), use the `curl` tool directly — do not wrap a single request in investigate.",
  "External HTTP via `bash` (curl/wget/etc.) is blocked. Use `curl` tool for one request, `investigate` for research.",
];

function isProxyMissingAtStartup(envNames: { login: string; pass: string; host: string; port: string }): string[] {
  const missing: string[] = [];
  if (!process.env[envNames.login]) missing.push(envNames.login);
  if (!process.env[envNames.pass]) missing.push(envNames.pass);
  if (!process.env[envNames.host]) missing.push(envNames.host);
  if (!process.env[envNames.port]) missing.push(envNames.port);
  return missing;
}

export default function investigate(pi: ExtensionAPI): void {
  let config;
  try {
    config = getConfig();
  } catch (err) {
    throw new Error(`investigate extension config.yml invalid: ${(err as Error).message}`);
  }

  // The investigate extension does NOT own proxy env var names (curl does), so
  // we hard-code the canonical defaults (DI_*) for the startup probe. The actual
  // enforcement happens in curl's executor at request time.
  const proxyEnvNames = { login: "DI_LOGIN", pass: "DI_SEC", host: "DI_HOST", port: "DI_PORT" };

  pi.on("session_start", (_event, ctx) => {
    const missing = isProxyMissingAtStartup(proxyEnvNames);
    if (missing.length > 0) {
      ctx.ui.notify(
        `investigate extension: proxy env vars missing (${missing.join(", ")}). investigate calls will fail until set.`,
        "warning",
      );
    }
  });

  // --- Bash guard ---
  pi.on("tool_call", (event) => {
    if (!isToolCallEventType("bash", event)) return undefined;
    const command = event.input.command;
    if (typeof command !== "string") return undefined;
    const verdict = checkBashCommand(command, config.bash_guard);
    return verdict ?? undefined;
  });

  // --- investigate tool ---
  pi.registerTool({
    name: "investigate",
    label: "Investigate (multi-source research)",
    description: DESCRIPTION,
    promptGuidelines: GUIDELINES,
    parameters: InvestigateParams,
    async execute(_id, params, signal, onUpdate: AgentToolUpdateCallback<{ findings: Finding[] }> | undefined, ctx): Promise<AgentToolResult<{ findings: Finding[] }>> {
      try {
        const input = params as InvestigateInput;

        // 1. Proxy precondition (sub-pi investigators ALL call curl)
        const missing = isProxyMissingAtStartup(proxyEnvNames);
        if (missing.length > 0) throw new MissingProxyEnvError(missing);

        // 2. Resolve depth + freshness
        const profile = resolveDepth(config, input.depth);
        const freshness = input.freshness ?? config.defaults.freshness;
        const cutoffDate = freshnessToDate(freshness);

        // 3. PLAN
        onUpdate?.({ content: [{ type: "text", text: `Planning ${profile.sub_questions} sub-questions…` }], details: { findings: [] } });
        const subQuestions = await planSubQuestions({
          pregunta: input.pregunta,
          n: profile.sub_questions,
          cutoffDate,
          profile,
          cwd: ctx.cwd,
          signal,
        });

        // 4. MAP (parallel, semaphore-bounded)
        const semaphore = createSemaphore(profile.concurrency_limit);
        const live: Finding[] = subQuestions.map((sq) => ({ subQuestion: sq, status: "ok" as const, text: "", durationMs: 0 }));
        let doneCount = 0;
        const findings = await Promise.all(
          subQuestions.map(async (sq, i): Promise<Finding> => {
            await semaphore.acquire();
            try {
              const f = await runInvestigator({
                originalPregunta: input.pregunta,
                subQuestion: sq,
                cutoffDate,
                profile,
                cwd: ctx.cwd,
                maxTextKb: config.limits.max_subpi_text_kb,
                signal,
              });
              live[i] = f;
              doneCount++;
              onUpdate?.({
                content: [{ type: "text", text: `${doneCount}/${subQuestions.length} sub-investigators done` }],
                details: { findings: [...live] },
              });
              return f;
            } finally {
              semaphore.release();
            }
          }),
        );

        // 5. REDUCE
        onUpdate?.({ content: [{ type: "text", text: "Synthesizing…" }], details: { findings } });
        const report = await synthesize({ pregunta: input.pregunta, findings, cutoffDate, profile, cwd: ctx.cwd, signal });

        return { content: [{ type: "text", text: report }], details: { findings } };
      } catch (err) {
        const e = err as Error;
        return {
          content: [{ type: "text", text: `${e.name}: ${e.message}` }],
          details: { findings: [] },
        };
      }
    },
  });
}
