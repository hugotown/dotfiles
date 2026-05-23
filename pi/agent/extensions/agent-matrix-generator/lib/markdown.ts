import { readFileSync, writeFileSync } from "node:fs";

export function buildAgentMarkdown(args: {
  title: string;
  base: string;
  providerId: string;
  modelId: string;
  body: string;
}): string {
  const desc = `${args.title} powered by ${args.providerId}/${args.modelId}`;
  const fm = [
    "---",
    `description: ${yamlEscape(desc)}`,
    `provider: ${args.providerId}`,
    `model: ${args.modelId}`,
    `generated: true`,
    `generatedFrom: ${args.base}`,
    "---",
    "",
  ].join("\n");
  const body = args.body.endsWith("\n") ? args.body : args.body + "\n";
  return `${fm}${body}`;
}

/** Single-line YAML scalar safety for frontmatter values. */
function yamlEscape(value: string): string {
  if (
    /[:#]/.test(value) ||
    /^\s/.test(value) ||
    /^[-?!&*|>]/.test(value) ||
    value.includes("'") ||
    value.includes('"')
  ) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return value;
}

/** Write only if content differs from existing file. Returns true if written. */
export function writeIfChanged(absPath: string, content: string): boolean {
  try {
    const existing = readFileSync(absPath, "utf8");
    if (existing === content) return false;
  } catch {
    // file doesn't exist — write it
  }
  writeFileSync(absPath, content);
  return true;
}
