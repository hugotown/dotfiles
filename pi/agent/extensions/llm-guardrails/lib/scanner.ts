import micromatch from "micromatch";
import type { Match, Rule } from "./types.ts";

function lineStart(content: string, offset: number): number {
  return content.lastIndexOf("\n", offset - 1) + 1;
}

function lineEnd(content: string, offset: number): number {
  const end = content.indexOf("\n", offset);
  return end === -1 ? content.length : end;
}

function insideStringLiteralOnLine(content: string, offset: number): boolean {
  const start = lineStart(content, offset);
  const before = content.slice(start, offset);

  for (const quote of ['"', "'", "`"] as const) {
    let open = false;
    for (let i = 0; i < before.length; i += 1) {
      if (before[i] === "\\") {
        i += 1;
        continue;
      }
      if (before[i] === quote) open = !open;
    }
    if (open) return true;
  }

  return false;
}

function insideUrlOnLine(content: string, offset: number): boolean {
  const start = lineStart(content, offset);
  const before = content.slice(start, offset);

  return /\b[A-Za-z][A-Za-z0-9+.-]*:$/.test(before);
}

function lineAndColumn(content: string, offset: number): { line: number; column: number } {
  let line = 1;
  let lastNewline = -1;

  for (let i = 0; i < offset; i += 1) {
    if (content.charCodeAt(i) === 10) {
      line += 1;
      lastNewline = i;
    }
  }

  return { line, column: offset - lastNewline };
}

function cloneGlobal(pattern: RegExp): RegExp {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;

  return new RegExp(pattern.source, flags);
}

export function scan(file: string, content: string, rules: readonly Rule[]): Match[] {
  const matches: Match[] = [];
  const seen = new Set<string>();

  for (const rule of rules) {
    if (!micromatch.isMatch(file, [...rule.filePatterns])) continue;

    for (const originalPattern of rule.patterns) {
      const pattern = cloneGlobal(originalPattern);
      let found: RegExpExecArray | null;

      while ((found = pattern.exec(content)) !== null) {
        if (found[0].length === 0) {
          pattern.lastIndex += 1;
          continue;
        }

        const offset = found.index;
        if (insideStringLiteralOnLine(content, offset) || insideUrlOnLine(content, offset)) continue;

        const key = `${rule.id}:${offset}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const { line, column } = lineAndColumn(content, offset);
        matches.push({
          ruleId: rule.id,
          file,
          line,
          column,
          matchedText: content.slice(offset, Math.min(lineEnd(content, offset), offset + found[0].length)),
        });
      }
    }
  }

  return matches.sort((a, b) => a.line - b.line || a.column - b.column || a.ruleId.localeCompare(b.ruleId));
}
