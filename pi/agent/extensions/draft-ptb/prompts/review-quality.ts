// Code-quality reviewer prompt.
// Model: gpt-5.4 (different reasoning style than the Claude/Gemini reviewers).
//
// Job: read the implementation looking for quality issues — naming, YAGNI,
// edge-case handling, error swallowing, hard-coded values that should be config.

import type { DraftState } from "../state.ts";
import {
  renderFileContracts,
  renderImplementationResults,
  buildOutputContract,
} from "./review-shared.ts";

export function buildReviewQualityPrompt(state: DraftState): string {
  return [
    `# Code-Quality Reviewer`,
    ``,
    `You are reviewing the freshly implemented code for quality issues. You may use`,
    `\`read\` to inspect files and \`bash\` for read-only commands (cat, ls, grep, rg).`,
    `Do NOT modify any file. Do NOT run tests or builds.`,
    ``,
    `## Implementation under review`,
    ``,
    renderImplementationResults(state.implementationResults),
    ``,
    `## File-contract context (so you know intent)`,
    ``,
    renderFileContracts(state.fileContracts),
    ``,
    `## Your task`,
    ``,
    `Read every file in \`filesWritten\` above and look for:`,
    `1. **Silent failure**: errors swallowed without logging, returning sentinel values`,
    `   instead of throwing, empty catch blocks.`,
    `2. **Edge cases missed**: null/undefined inputs, empty arrays, zero values,`,
    `   off-by-one in loops, race conditions when async.`,
    `3. **YAGNI violations**: speculative configuration knobs, unused parameters,`,
    `   abstractions for a single caller, dead branches.`,
    `4. **Naming and clarity**: misleading variable/function names, magic numbers`,
    `   without a constant, comments that contradict the code.`,
    `5. **Hard-coded values** that should be parameters, env vars, or config.`,
    `6. **Resource leaks**: unclosed file handles, leftover timers/intervals,`,
    `   subprocesses that never wait().`,
    ``,
    `Skip:`,
    `- Style preferences already enforced by lint (the lint check ran and passed).`,
    `- Refactoring suggestions whose only justification is "I would write it differently".`,
    `- Anything covered by the contracts reviewer (signature compliance).`,
    `- Anything covered by the tests reviewer (test coverage).`,
    ``,
    `Severity:`,
    `- **critical**: silent failure on a code path the spec depends on, resource leak`,
    `  in a long-lived process, hard-coded credential or secret.`,
    `- **important**: missing edge-case handling for inputs the spec mentions, dead`,
    `  configuration knob that ships in public surface.`,
    `- **minor**: naming nit, suggestion to extract a magic number.`,
    ``,
    buildOutputContract("draft_ptb_review_quality"),
  ].join("\n");
}
