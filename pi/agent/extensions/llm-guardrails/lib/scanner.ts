import micromatch from "micromatch";
import type { Match, Rule } from "./types.ts";

function lineStarts(content: string): number[] {
  const starts = [0];

  for (let i = 0; i < content.length; i += 1) {
    if (content.charCodeAt(i) === 10) starts.push(i + 1);
  }

  return starts;
}

function lineIndexForOffset(starts: readonly number[], offset: number): number {
  let low = 0;
  let high = starts.length - 1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const start = starts[middle];
    const nextStart = starts[middle + 1] ?? Infinity;

    if (offset < start) {
      high = middle - 1;
    } else if (offset >= nextStart) {
      low = middle + 1;
    } else {
      return middle;
    }
  }

  return starts.length - 1;
}

function lineEnd(content: string, starts: readonly number[], lineIndex: number): number {
  return starts[lineIndex + 1] === undefined ? content.length : starts[lineIndex + 1] - 1;
}

function insideStringLiteralOnLine(content: string, lineStart: number, offset: number): boolean {
  type Quote = '"' | "'" | "`";

  let open: Quote | undefined;
  const quoteChars = new Set<string>(['"', "'", "`"]);
  const before = content.slice(lineStart, offset);

  for (let i = 0; i < before.length; i += 1) {
    const char = before[i];

    if (open !== undefined) {
      if (char === "\\") {
        i += 1;
        continue;
      }
      if (char === open) open = undefined;
      continue;
    }

    if (quoteChars.has(char)) open = char as Quote;
  }

  return open !== undefined;
}

function insideUrlOnLine(content: string, lineStart: number, offset: number): boolean {
  const before = content.slice(lineStart, offset);

  return /\b[A-Za-z][A-Za-z0-9+.-]*:$/.test(before);
}

function lineAndColumn(starts: readonly number[], lineIndex: number, offset: number): { line: number; column: number } {
  return { line: lineIndex + 1, column: offset - starts[lineIndex] + 1 };
}

function cloneGlobal(pattern: RegExp): RegExp {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;

  return new RegExp(pattern.source, flags);
}

export function scan(file: string, content: string, rules: readonly Rule[]): Match[] {
  const matches: Match[] = [];
  const seen = new Set<string>();
  const starts = lineStarts(content);

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
        const lineIndex = lineIndexForOffset(starts, offset);
        const start = starts[lineIndex];
        if (insideStringLiteralOnLine(content, start, offset) || insideUrlOnLine(content, start, offset)) continue;

        const key = `${rule.id}:${offset}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const { line, column } = lineAndColumn(starts, lineIndex, offset);
        matches.push({
          ruleId: rule.id,
          file,
          line,
          column,
          matchedText: content.slice(offset, Math.min(lineEnd(content, starts, lineIndex), offset + found[0].length)),
        });
      }
    }
  }

  return matches.sort((a, b) => a.line - b.line || a.column - b.column || a.ruleId.localeCompare(b.ruleId));
}
