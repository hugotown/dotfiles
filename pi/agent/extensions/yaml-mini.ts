/**
 * yaml-mini — Minimal YAML subset parser (no external dep).
 *
 * Why this exists: jiti doesn't resolve the `yaml` package from
 * ~/.pi/agent/extensions/ even though it lives in pi-coding-agent's
 * node_modules. Rather than ship a package.json + install step, we
 * implement just the subset we need.
 *
 * Supported (chains.yaml + safety.yaml shapes):
 *   - Top-level mappings: key: value
 *   - Nested mappings via indentation
 *   - Sequences (lists) with `- scalar` and `- key: value` items
 *   - Flow sequences: [a, b, c] (strings only)
 *   - Block scalars: `|` (literal, keeps newlines) and `>` (folded)
 *   - Quoted strings: "..." and '...'
 *   - Line comments: # ...
 *   - Numbers and booleans (true/false/null) as scalars
 *
 * NOT supported (intentionally):
 *   - Anchors / aliases (& / *)
 *   - Tags (!!str, !Custom)
 *   - Flow mappings: { a: b }
 *   - Multi-document streams (---)
 *
 * Design: recursive descent on indentation. The parser is line-oriented;
 * after stripping comments and blank lines, each significant line carries
 * an indent level that determines its position in the tree.
 */

export type YamlValue = string | number | boolean | null | YamlValue[] | { [k: string]: YamlValue };

interface Line {
  indent: number;
  content: string;
  raw: string;
  lineNumber: number;
}

function tokenize(input: string): Line[] {
  const out: Line[] = [];
  const rawLines = input.split(/\r?\n/);
  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    // Strip comments — but preserve # inside quoted strings (best-effort)
    let stripped = raw;
    const hashIdx = findUnquotedHash(stripped);
    if (hashIdx !== -1) stripped = stripped.slice(0, hashIdx);
    const trimmed = stripped.trimEnd();
    if (trimmed.trim() === "") continue;
    const indent = trimmed.match(/^ */)![0].length;
    out.push({ indent, content: trimmed.slice(indent), raw, lineNumber: i + 1 });
  }
  return out;
}

function findUnquotedHash(s: string): number {
  let inSingle = false, inDouble = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === "#" && !inSingle && !inDouble) {
      // Only treat as comment if preceded by whitespace or at line start
      if (i === 0 || /\s/.test(s[i - 1])) return i;
    }
  }
  return -1;
}

function parseScalar(raw: string): YamlValue {
  const s = raw.trim();
  if (s === "" || s === "~" || s === "null") return null;
  if (s === "true") return true;
  if (s === "false") return false;
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  if (s.startsWith("[") && s.endsWith("]")) {
    return s
      .slice(1, -1)
      .split(",")
      .map((p) => parseScalar(p))
      .filter((v): v is YamlValue => v !== null || s.slice(1, -1).trim() !== "");
  }
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s);
  return s;
}

function collectBlockScalar(lines: Line[], startIdx: number, parentIndent: number, mode: "literal" | "folded"): { value: string; consumed: number } {
  const collected: string[] = [];
  let baseIndent = -1;
  let i = startIdx;
  while (i < lines.length) {
    const line = lines[i];
    if (line.indent <= parentIndent) break;
    if (baseIndent === -1) baseIndent = line.indent;
    const slice = line.raw.slice(baseIndent);
    collected.push(slice);
    i++;
  }
  let value: string;
  if (mode === "literal") {
    value = collected.join("\n");
  } else {
    // Folded: blank lines preserve a newline, otherwise join with space
    const parts: string[] = [];
    let buf: string[] = [];
    for (const l of collected) {
      if (l.trim() === "") {
        if (buf.length > 0) { parts.push(buf.join(" ")); buf = []; }
        parts.push("");
      } else {
        buf.push(l.trim());
      }
    }
    if (buf.length > 0) parts.push(buf.join(" "));
    value = parts.join("\n");
  }
  return { value: value.replace(/\n+$/, ""), consumed: i - startIdx };
}

function parseValue(lines: Line[], startIdx: number, parentIndent: number): { value: YamlValue; consumed: number } {
  if (startIdx >= lines.length) return { value: null, consumed: 0 };
  const first = lines[startIdx];
  if (first.indent <= parentIndent) return { value: null, consumed: 0 };

  // Sequence (block style)
  if (first.content.startsWith("- ") || first.content === "-") {
    const items: YamlValue[] = [];
    let i = startIdx;
    while (i < lines.length && lines[i].indent === first.indent && (lines[i].content.startsWith("- ") || lines[i].content === "-")) {
      const itemLine = lines[i];
      const afterDash = itemLine.content.slice(2);
      // Inline mapping after dash: "- key: value"
      const colonIdx = afterDash.indexOf(":");
      if (colonIdx !== -1 && (afterDash[colonIdx + 1] === " " || colonIdx === afterDash.length - 1)) {
        // Build a synthetic line array starting with this key and continuing siblings
        const synthetic: Line[] = [{
          indent: itemLine.indent + 2,
          content: afterDash,
          raw: " ".repeat(itemLine.indent + 2) + afterDash,
          lineNumber: itemLine.lineNumber,
        }];
        // Append following lines until indent <= itemLine.indent + 2 - 1
        let j = i + 1;
        while (j < lines.length && lines[j].indent >= itemLine.indent + 2) {
          synthetic.push(lines[j]);
          j++;
        }
        const { value } = parseMapping(synthetic, 0, itemLine.indent + 1);
        items.push(value);
        i = j;
      } else if (afterDash.trim() === "") {
        // Nested structure on next lines
        const { value, consumed } = parseValue(lines, i + 1, itemLine.indent);
        items.push(value);
        i = i + 1 + consumed;
      } else {
        items.push(parseScalar(afterDash));
        i++;
      }
    }
    return { value: items, consumed: i - startIdx };
  }

  // Mapping
  return parseMapping(lines, startIdx, parentIndent);
}

function parseMapping(lines: Line[], startIdx: number, parentIndent: number): { value: { [k: string]: YamlValue }; consumed: number } {
  const out: { [k: string]: YamlValue } = {};
  let i = startIdx;
  let mappingIndent = -1;
  while (i < lines.length) {
    const line = lines[i];
    if (line.indent <= parentIndent) break;
    if (mappingIndent === -1) mappingIndent = line.indent;
    if (line.indent !== mappingIndent) break;

    const colonIdx = findKeyColon(line.content);
    if (colonIdx === -1) break;
    const key = line.content.slice(0, colonIdx).trim().replace(/^["']|["']$/g, "");
    const rest = line.content.slice(colonIdx + 1).trim();

    if (rest === "|" || rest === "|-" || rest === "|+") {
      const { value, consumed } = collectBlockScalar(lines, i + 1, line.indent, "literal");
      out[key] = value;
      i = i + 1 + consumed;
    } else if (rest === ">" || rest === ">-" || rest === ">+") {
      const { value, consumed } = collectBlockScalar(lines, i + 1, line.indent, "folded");
      out[key] = value;
      i = i + 1 + consumed;
    } else if (rest === "") {
      const { value, consumed } = parseValue(lines, i + 1, line.indent);
      out[key] = value;
      i = i + 1 + consumed;
    } else {
      out[key] = parseScalar(rest);
      i++;
    }
  }
  return { value: out, consumed: i - startIdx };
}

function findKeyColon(s: string): number {
  let inSingle = false, inDouble = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === ":" && !inSingle && !inDouble) {
      // Must be followed by space, end of line, or be at non-flow position
      if (i === s.length - 1 || s[i + 1] === " ") return i;
    }
  }
  return -1;
}

export function parseYaml(input: string): YamlValue {
  const lines = tokenize(input);
  if (lines.length === 0) return null;
  const { value } = parseValue(lines, 0, -1);
  return value;
}

// No-op default export so Pi's auto-loader accepts this as a (inert) extension.
export default function () { /* library module */ }
