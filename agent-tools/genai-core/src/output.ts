/**
 * Output-folder conventions (consolidates gemini-common output rules).
 * All artifacts land under gemini-output/<category>/<slug>_<YYYY-MM-DD>_<HHMMSS>.<ext>.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export type Category = "images" | "research" | "documents" | "vision" | "grounded";

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "output";
}

export function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function outputPath(cwd: string, category: Category, slug: string, ext: string): string {
  const dir = resolve(cwd, "gemini-output", category);
  mkdirSync(dir, { recursive: true });
  return join(dir, `${slugify(slug)}_${stamp()}.${ext}`);
}

export function saveText(path: string, text: string): string {
  writeFileSync(path, text, "utf8");
  return path;
}

export function saveBytes(path: string, base64: string): string {
  writeFileSync(path, Buffer.from(base64, "base64"));
  return path;
}
