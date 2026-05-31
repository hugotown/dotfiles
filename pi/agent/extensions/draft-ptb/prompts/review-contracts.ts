// Contracts-compliance reviewer prompt.
// Model: claude-opus-4.6 (deep critical anchoring).
//
// Job: read every implemented file in `filesWritten` and verify that exports
// match the declared FileContract signature/name. Catches "the implementer
// shipped a stub" or "wrong exported function name" early.

import type { DraftState } from "../state.ts";
import {
  renderFileContracts,
  renderImplementationResults,
  buildOutputContract,
} from "./review-shared.ts";

export function buildReviewContractsPrompt(state: DraftState): string {
  return [
    `# Contracts-Compliance Reviewer`,
    ``,
    `You are reviewing whether the implementation matches the declared file contracts.`,
    `You may use the \`read\` tool to inspect any file. Use \`bash\` only for read-only`,
    `commands (cat, ls, grep). Do NOT modify any file. Do NOT run tests or builds.`,
    ``,
    `## Declared file contracts (the source of truth)`,
    ``,
    renderFileContracts(state.fileContracts),
    ``,
    `## What was implemented`,
    ``,
    renderImplementationResults(state.implementationResults),
    ``,
    `## Your task`,
    ``,
    `For EACH file contract above, read the implemented file and verify:`,
    `1. Every declared export exists in the file with the exact name.`,
    `2. The signature of each export matches (parameters, return type, async-ness).`,
    `3. The imports the file actually does are consistent with the declared \`imports\` list.`,
    `4. The file's purpose (per the contract) is recognizable in its implementation —`,
    `   no empty stubs, no \`throw new Error("TODO")\` for behavior that should ship.`,
    ``,
    `Report MISMATCHES as issues. Do NOT report code-style or naming preferences here —`,
    `that is the quality reviewer's job. You ONLY check signature/export/structural fit.`,
    ``,
    `Severity:`,
    `- **critical**: export missing, wrong name, wrong arity, throws "not implemented".`,
    `- **important**: signature drift (e.g. declared sync, implemented async without wrapping),`,
    `  imports an undeclared cross-contract path.`,
    `- **minor**: contract says "returns Promise<string>" and code returns a literal-typed`,
    `  subtype like \`Promise<"ok" | "fail">\` — works at runtime, narrower than declared.`,
    ``,
    buildOutputContract("draft_ptb_review_contracts"),
  ].join("\n");
}
