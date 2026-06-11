// Step 6 — deterministic verification with evidence (no false greens).
// Commands are resolved hybrid-style first (config -> heuristic -> LLM fallback);
// any LLM-proposed command is persisted to the project yml with provenance. The
// verdict is ALWAYS the command's exit code, never an LLM opinion.

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { FlowEvent, FlowState } from "../types.ts";
import { runChecks } from "../lib/checks.ts";
import { resolveChecks } from "../lib/resolve-checks.ts";
import { persistResolvedChecks } from "../lib/yml-write.ts";
import { projectConfigPath } from "../lib/paths.ts";
import { logEvent } from "../lib/observability.ts";

type Advance = (ctx: ExtensionContext, event: FlowEvent) => Promise<void>;

export async function driveVerify(
  state: FlowState,
  _pi: ExtensionAPI,
  ctx: ExtensionContext,
  advance: Advance,
): Promise<void> {
  ctx.ui.notify("🔬 Verifying (build / typecheck / tests / lint / format)...", "info");

  const { resolved, llmResolved } = await resolveChecks(ctx.cwd, state.config);
  if (Object.keys(llmResolved).length) {
    try {
      persistResolvedChecks(projectConfigPath(ctx.cwd), llmResolved);
      const summary = Object.entries(llmResolved).map(([k, v]) => `${k}="${v}"`).join(", ");
      ctx.ui.notify(`🔎 LLM resolved checks: ${summary} (saved to obra-sp-flow.yml)`, "info");
    } catch (e) {
      ctx.ui.notify(`Could not persist resolved checks: ${String(e).slice(0, 160)}`, "warning");
    }
  }
  logEvent({ event: "checks_resolved", resolved, llmResolved });

  const result = runChecks(ctx.cwd, state.config, resolved);
  const summary = result.passed ? "✅ all green" : `❌ ${result.failures.join("; ")}`;
  ctx.ui.notify(`Verification: ${summary}`, result.passed ? "info" : "warning");
  logEvent({
    event: "checks_done",
    passed: result.passed,
    failures: result.failures,
    coverage: result.coverage,
    results: result.results.map((r) => ({ name: r.name, passed: r.passed, skipped: r.skipped ?? false })),
  });
  await advance(ctx, { type: "CHECKS_DONE", result });
}
