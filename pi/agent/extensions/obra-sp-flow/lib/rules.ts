// Renders a phase's custom rules into a prompt block. Empty rules => no block.

export function rulesBlock(rules: string[]): string {
  if (!rules.length) return "";
  return ["", "## Phase custom rules (MUST follow at all times)", ...rules.map((r) => `- ${r}`)].join("\n");
}
