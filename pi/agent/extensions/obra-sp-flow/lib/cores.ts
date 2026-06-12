// Loads distilled skill "cores" (.md) shipped inside the extension. These replace
// reading the full external SKILL.md from disk: same design intent, a fraction of
// the tokens, and none of the conflicting "ask approval / write doc / invoke X"
// steps the code-driven harness now owns. Missing file => "" (caller degrades).

import * as fs from "node:fs";
import { fileURLToPath } from "node:url";

export function loadCore(name: string): string {
  try {
    return fs.readFileSync(fileURLToPath(new URL(`../cores/${name}.md`, import.meta.url)), "utf-8").trim();
  } catch {
    return "";
  }
}
