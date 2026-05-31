// Re-exports for backward compatibility.
// The original monolithic module has been split into:
//   - decision.ts (decide logic)
//   - ship.ts (commit + push + PR)
//   - pr-builder.ts (commit message, PR title/body)
//   - escalation.ts (escalation summary)

export { decide, collectTargets, type Decision } from "./decision.ts";
export { ship } from "./ship.ts";
export { buildEscalationSummary } from "./escalation.ts";
