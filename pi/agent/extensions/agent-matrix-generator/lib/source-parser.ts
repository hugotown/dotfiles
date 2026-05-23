import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SOURCE_DIR, OUTPUT_DIR } from "./constants";
import { log } from "./log";
import type { SourceFile } from "../types";

export function baseNameFromFile(file: string): string {
  return file
    .replace(/-prompt\.md$/, "")
    .replace(/-agent\.md$/, "")
    .replace(/\.md$/, "");
}

export function readSourceFile(file: string): SourceFile | null {
  try {
    const body = readFileSync(join(SOURCE_DIR, file), "utf8");
    const nl = body.indexOf("\n");
    const firstLine = nl === -1 ? body : body.slice(0, nl);
    const title =
      firstLine.replace(/^#\s+/, "").trim() || baseNameFromFile(file);
    return { firstLine, title, body };
  } catch (err) {
    log("could not read source file", { file, error: String(err) });
    return null;
  }
}

export function parseFrontmatter(content: string): {
  meta: Record<string, string>;
  body: string;
} {
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!fm) return { meta: {}, body: content };
  const meta: Record<string, string> = {};
  for (const line of fm[1].split(/\r?\n/)) {
    const m = line.match(/^([\w-]+):\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    meta[m[1]] = value;
  }
  return { meta, body: fm[2] };
}

export function isGeneratedFile(absPath: string): boolean {
  try {
    const raw = readFileSync(absPath, "utf8");
    const { meta } = parseFrontmatter(raw);
    return meta.generated === "true";
  } catch {
    return false;
  }
}

export function listGeneratedFiles(): string[] {
  let entries: string[];
  try {
    entries = readdirSync(OUTPUT_DIR);
  } catch {
    return [];
  }
  return entries
    .filter((f) => f.endsWith(".md"))
    .filter((f) => isGeneratedFile(join(OUTPUT_DIR, f)));
}
