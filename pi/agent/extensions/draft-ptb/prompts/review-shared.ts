// Shared rendering helpers for the three reviewer prompts (contracts/quality/tests).
//
// Reviewers run as child `pi` processes. They share the same INPUT shape (the
// implementation we want reviewed) but differ in WHAT they look for. We keep the
// input rendering here and let each prompt file own its dimension-specific brief.

import type { FileContract, TestContract, TestSurface, ImplementationResult } from "../state.ts";

export function renderFileContracts(contracts: FileContract[]): string {
  if (contracts.length === 0) return "_(no file contracts)_";
  return contracts
    .map((c) => {
      const exports = c.exports
        .map((e) => `    - \`${e.name}\`: ${e.signature} — ${e.description}`)
        .join("\n");
      const imports = c.imports.length > 0 ? c.imports.join(", ") : "(none)";
      return [
        `### \`${c.path}\``,
        `**Purpose**: ${c.purpose}`,
        `**Imports**: ${imports}`,
        `**Exports**:`,
        exports || "    - (none)",
      ].join("\n");
    })
    .join("\n\n");
}

export function renderTestContracts(contracts: TestContract[]): string {
  if (contracts.length === 0) return "_(no test contracts)_";
  return contracts
    .map((c) => {
      const under = c.codeContractsUnderTest.length > 0 ? c.codeContractsUnderTest.join(", ") : "(none)";
      return `- \`${c.path}\` (${c.kind}) — covers journey \`${c.journey}\`, exercises: ${under}`;
    })
    .join("\n");
}

export function renderTestSurface(surface: TestSurface | null): string {
  if (!surface || (surface.journeys.length === 0 && surface.integrationBoundaries.length === 0)) {
    return "_(no test surface defined)_";
  }
  const journeys = surface.journeys
    .map(
      (j) =>
        `- **${j.id}** — ${j.name}\n  steps: ${j.steps.join(" → ") || "(none)"}\n  invariants: ${j.invariants.join("; ") || "(none)"}`,
    )
    .join("\n");
  const boundaries = surface.integrationBoundaries
    .map(
      (b) =>
        `- **${b.id}** — modules: ${b.modules.join(", ")}\n  invariants: ${b.invariants.join("; ") || "(none)"}`,
    )
    .join("\n");
  return [
    "**Journeys**:",
    journeys || "_(none)_",
    "",
    "**Integration boundaries**:",
    boundaries || "_(none)_",
  ].join("\n");
}

export function renderImplementationResults(results: ImplementationResult[]): string {
  if (results.length === 0) return "_(no implementation results recorded)_";
  return results
    .map((r) => {
      const files = r.filesWritten.length > 0 ? r.filesWritten.join(", ") : "(no files written)";
      const concerns = r.concerns ? ` — concerns: ${r.concerns}` : "";
      return `- \`${r.taskId}\`: ${r.status}${concerns}\n  files: ${files}`;
    })
    .join("\n");
}

/**
 * Common output instructions appended to every reviewer prompt.
 * Reviewers MUST end with a single JSON object as their final assistant message.
 *
 * `toolName` is the registered tool the reviewer calls to emit the verdict; the tool
 * is stateless and its return value (the JSON) IS the agent's final text, which the
 * parent dispatcher parses.
 */
export function buildOutputContract(toolName: string): string {
  return [
    `## OUTPUT CONTRACT (non-negotiable)`,
    ``,
    `You MUST emit your verdict by calling the tool \`${toolName}\` exactly once as your`,
    `final action. Do NOT write anything after the tool call.`,
    ``,
    `Schema:`,
    `\`\`\`json`,
    `{`,
    `  "approved": boolean,`,
    `  "issues": [`,
    `    {`,
    `      "severity": "critical" | "important" | "minor",`,
    `      "file": "path/to/file.ts",`,
    `      "line": 42 | null,`,
    `      "description": "what is wrong, concretely",`,
    `      "fixSuggestion": "concrete actionable fix"`,
    `    }`,
    `  ]`,
    `}`,
    `\`\`\``,
    ``,
    `Severity guide:`,
    `- **critical**: ships broken behavior (wrong signature, missing required export, test that does not actually test the invariant). Triggers iteration ALWAYS.`,
    `- **important**: degrades quality (silent error swallowing, missing edge case, hard-coded value that should be config). Triggers iteration when budget allows.`,
    `- **minor**: nit (style, naming). Logged but does NOT trigger iteration.`,
    ``,
    `Set \`approved\` to TRUE only when there are zero critical issues AND zero important issues.`,
    `An empty \`issues\` array with \`approved: true\` is allowed and means the dimension passes.`,
  ].join("\n");
}
