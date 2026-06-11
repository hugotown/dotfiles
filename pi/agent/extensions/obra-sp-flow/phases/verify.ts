// Step 6 — deterministic verification with evidence (no false greens).

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { FlowEvent, FlowState } from "../types.ts";
import { runChecks } from "../lib/checks.ts";

type Advance = (ctx: ExtensionContext, event: FlowEvent) => Promise<void>;

export async function driveVerify(
  state: FlowState,
  _pi: ExtensionAPI,
  ctx: ExtensionContext,
  advance: Advance,
): Promise<void> {
  ctx.ui.notify("🔬 Verifying (typecheck / lint / tests / coverage)...", "info");
  const result = runChecks(ctx.cwd, state.config);
  const summary = result.passed ? "✅ all green" : `❌ ${result.failures.join("; ")}`;
  ctx.ui.notify(`Verification: ${summary}`, result.passed ? "info" : "warning");
  await advance(ctx, { type: "CHECKS_DONE", result });
}
