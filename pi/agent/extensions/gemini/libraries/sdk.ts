/** Consolidated gemini-libraries: report the installed JS SDK + migration guidance. */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

export function buildSdkReport(): string {
  let version = "not found";
  try {
    const require = createRequire(import.meta.url);
    const pkgPath = require.resolve("@google/genai/package.json");
    version = (JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string }).version;
  } catch {
    /* leave as "not found" */
  }

  return [
    "# Gemini SDK (JavaScript / TypeScript)",
    "",
    `Installed @google/genai: ${version}`,
    "",
    "Deprecated — migrate OFF (sunset 2025-11-30):",
    "  @google/generativeai → @google/genai",
    "",
    "Install / upgrade:",
    "  bun add @google/genai      # or: npm i @google/genai",
    "",
    "Client: `import { GoogleGenAI } from \"@google/genai\"; const ai = new GoogleGenAI({ apiKey });`",
  ].join("\n");
}
