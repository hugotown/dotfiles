// investigate — pi extension. Registers two surfaces:
//   1. `investigate` tool: research orchestrator (PLAN → parallel MAP → REDUCE).
//   2. `tool_call` interceptor on built-in `bash`: blocks external HTTP commands
//      so the LLM uses `curl` / `investigate` instead (proxy + SSRF enforced).
//
// Coupling with the `curl` extension is RUNTIME ONLY — never imported. Each
// investigator sub-pi spawns with `--tools curl`; if the curl extension is
// loaded in the same pi installation, the sub-pi exposes it. If not, the
// sub-pi fails fast at startup (captured as an error Finding, synthesis proceeds).
//
// Set INVESTIGATE_VERBOSE=0 (or false/no) to silence the stderr progress log.
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
  "Internally: PLAN (split into N orthogonal sub-questions) → MAP (N sub-pi investigators in parallel, each with the `curl` tool) → REDUCE (single synthesis for ≤6 findings, map-reduce fusion for more).",
  "Realistic wall-clock budgets per depth: light~2min / medium~5min / high~10min / deep~15min. NEVER reinvoke if a call is still in flight — wait for it to finish.",
  "If synthesis cannot complete within budget the tool returns a raw-findings fallback (still useful, you can summarise it yourself).",
  "Use this for ANY broad research; for single HTTP requests use the `curl` tool directly.",
].join(" ");

const GUIDELINES = [
  "Pick the smallest depth that fits — deep is expensive AND slow (up to 15 minutes). Use 'light' for a single fact, 'medium' for standard analysis, 'high' for broad research, 'deep' only for thesis-grade work where you truly need 12 angles.",
  "The pregunta must be SPECIFIC. Bad: 'React'. Good: 'state management patterns for React 19 server components'.",
  "Each `investigate` call may take SEVERAL MINUTES. Do NOT reinvoke the tool while a previous call is still running.",
  "If the tool returns a fallback report ('# Reporte de investigación (fallback sin síntesis)'), that means synthesis failed but the raw findings are present — summarise them yourself rather than calling investigate again.",
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

/** Resolve INVESTIGATE_VERBOSE env var. Defaults to ON to preserve current behaviour. */
function isVerboseEnabled(): boolean {
  const raw = process.env.INVESTIGATE_VERBOSE;
  if (raw === undefined) return true;
  const v = raw.toLowerCase().trim();
  return !(v === "0" || v === "false" || v === "no" || v === "off");
}

const VERBOSE = isVerboseEnabled();
function vlog(line: string): void {
  if (VERBOSE) console.error(line);
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
      // Mutable accumulator outside try so findings survive errors after MAP phase.
      let collectedFindings: Finding[] = [];

      // Compose the parent's signal with our wall-clock budget timer. Whichever
      // fires first aborts everything downstream.
      const localAbort = new AbortController();
      const onParentAbort = () => localAbort.abort();
      if (signal) {
        if (signal.aborted) localAbort.abort();
        else signal.addEventListener("abort", onParentAbort, { once: true });
      }
      let budgetTimer: ReturnType<typeof setTimeout> | undefined;
      const cleanup = () => {
        if (budgetTimer) clearTimeout(budgetTimer);
        if (signal) signal.removeEventListener("abort", onParentAbort);
      };

      try {
        const input = params as InvestigateInput;

        // 1. Proxy precondition (sub-pi investigators ALL call curl)
        const missing = isProxyMissingAtStartup(proxyEnvNames);
        if (missing.length > 0) throw new MissingProxyEnvError(missing);

        // 2. Resolve depth + freshness
        const profile = resolveDepth(config, input.depth);
        const freshness = input.freshness ?? config.defaults.freshness;
        const cutoffDate = freshnessToDate(freshness);

        // 2.5 Arm the wall-clock budget timer now that we know the depth.
        budgetTimer = setTimeout(() => {
          vlog(`[investigate] wall-clock budget ${profile.wall_clock_budget_ms}ms exceeded — aborting`);
          localAbort.abort();
        }, profile.wall_clock_budget_ms);

        // 3. PLAN
        const runStart = Date.now();
        vlog(`[investigate] start depth=${input.depth} N=${profile.sub_questions} cutoff=${cutoffDate ?? "any"} retries=${profile.investigator_max_retries} budget=${profile.wall_clock_budget_ms}ms`);
        onUpdate?.({ content: [{ type: "text", text: `Planning ${profile.sub_questions} sub-questions…` }], details: { findings: [] } });
        const subQuestions = await planSubQuestions({
          pregunta: input.pregunta,
          n: profile.sub_questions,
          cutoffDate,
          profile,
          cwd: ctx.cwd,
          signal: localAbort.signal,
        });
        vlog(`[investigate] plan ok: ${subQuestions.length} sub-questions (${Date.now() - runStart}ms elapsed)`);

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
                signal: localAbort.signal,
              });
              live[i] = f;
              doneCount++;
              const tag = f.partial ? `${f.status}+partial` : f.status;
              vlog(`[investigate] sub ${i + 1}/${subQuestions.length} ${tag} ${f.durationMs}ms exit=${f.exitCode ?? "n/a"} attempts=${(f.attempts ?? 0) + 1}${f.errorMessage ? ` err="${f.errorMessage.slice(0, 120)}"` : ""}`);
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

        // Persist findings so the catch block can return them if anything below blows up.
        collectedFindings = findings;

        // 5. REDUCE
        const okCount = findings.filter((f) => f.status === "ok").length;
        vlog(`[investigate] map done: ${okCount}/${findings.length} usable (${Date.now() - runStart}ms elapsed); starting synthesis`);
        onUpdate?.({ content: [{ type: "text", text: "Synthesizing…" }], details: { findings } });
        const report = await synthesize({ pregunta: input.pregunta, findings, cutoffDate, profile, cwd: ctx.cwd, signal: localAbort.signal });
        vlog(`[investigate] synthesis ok: ${report.length} chars (${Date.now() - runStart}ms elapsed total)`);

        return { content: [{ type: "text", text: report }], details: { findings } };
      } catch (err) {
        const e = err as Error;
        vlog(`[investigate] FAILED ${e.name}: ${e.message} (findings collected: ${collectedFindings.length})`);
        let text = `${e.name}: ${e.message}`;
        if (collectedFindings.length > 0) {
          const lines = ["", "--- Raw Findings ---"];
          for (const f of collectedFindings) {
            lines.push(`**${f.subQuestion}** [${f.status}]`);
            if (f.text) lines.push(f.text.slice(0, 500) + (f.text.length > 500 ? "…" : ""));
            else if (f.errorMessage) lines.push(`Error: ${f.errorMessage}`);
            lines.push("");
          }
          lines.push("-----------------------");
          text += lines.join("\n");
        }
        return {
          content: [{ type: "text", text }],
          details: { findings: collectedFindings },
        };
      } finally {
        cleanup();
      }
    },
  });
}
