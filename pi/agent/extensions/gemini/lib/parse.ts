/**
 * Parse inline subflags out of a flag's free-text argument.
 *
 *   --gemini-generate-image "a cat" --size 4k --aspect 9:16
 *     → positional: "a cat", opts: { size: "4k", aspect: "9:16" }
 *
 * Supports `--key value`, `--key=value`, quoted values, and boolean subflags
 * (no following value, or one listed in `booleanKeys`, map to "true").
 */
export interface ParsedArgs {
  positional: string;
  opts: Record<string, string>;
}

function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    tokens.push(m[1] ?? m[2] ?? m[3] ?? "");
  }
  return tokens;
}

export function parseSubflags(text: string, booleanKeys: string[] = []): ParsedArgs {
  const tokens = tokenize(text.trim());
  const opts: Record<string, string> = {};
  const positional: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (!tok.startsWith("--")) {
      positional.push(tok);
      continue;
    }
    const body = tok.slice(2);
    const eq = body.indexOf("=");
    if (eq >= 0) {
      opts[body.slice(0, eq)] = body.slice(eq + 1);
      continue;
    }
    const next = tokens[i + 1];
    if (booleanKeys.includes(body) || next === undefined || next.startsWith("--")) {
      opts[body] = "true";
    } else {
      opts[body] = next;
      i++;
    }
  }

  return { positional: positional.join(" "), opts };
}

/** Overlay parsed subflags onto a form's initial values via a key→fieldId map. */
export function applyAliases(
  initial: Record<string, string>,
  opts: Record<string, string>,
  aliases: Record<string, string>,
): Record<string, string> {
  const out = { ...initial };
  for (const [key, value] of Object.entries(opts)) {
    const fieldId = aliases[key];
    if (fieldId) out[fieldId] = value;
  }
  return out;
}
