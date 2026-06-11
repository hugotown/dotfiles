// /obra-sp-flow-init — scaffolds {cwd}/.pi/obra-sp-flow/obra-sp-flow.yml from the
// extension defaults, pre-filling each phase's `tools:` with a curated starter set.
// brainstorm additionally gets ask_user_question (the only interactive phase);
// subagent is intentionally absent (this pipeline orchestrates child pis itself).

import * as fs from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { defaultConfigPath } from "../lib/config-load.ts";
import { projectConfigPath, projectDir } from "../lib/paths.ts";

// Curated default tool set written into the generated template (editable per project).
const TEMPLATE_TOOLS = [
  "bash",
  "curl",
  "edit",
  "find",
  "gemini_analyze_image",
  "gemini_google_search",
  "gemini_libraries",
  "gemini_process_document",
  "gemini_status",
  "grep",
  "ls",
  "obra_spec",
  "read",
  "write",
];

/** Replace each `tools: []` with the curated list for its phase. */
export function fillTools(yaml: string): string {
  const brainstorm = [...TEMPLATE_TOOLS, "ask_user_question"].sort();
  let phase = "";
  return yaml
    .split("\n")
    .map((line) => {
      const header = line.match(/^ {2}(\w+):\s*$/);
      if (header) phase = header[1];
      if (line === "    tools: []") {
        const list = phase === "brainstorm" ? brainstorm : TEMPLATE_TOOLS;
        return ["    tools:", ...list.map((t) => `      - ${t}`)].join("\n");
      }
      return line;
    })
    .join("\n");
}

export function registerInit(pi: ExtensionAPI): void {
  pi.registerCommand("obra-sp-flow-init", {
    description: "Scaffold {cwd}/.pi/obra-sp-flow/obra-sp-flow.yml with defaults + a curated tool set per phase",
    handler: async (_args, ctx) => {
      const dest = projectConfigPath(ctx.cwd);
      if (fs.existsSync(dest)) {
        ctx.ui.notify(`Already exists: ${dest}`, "warning");
        return;
      }
      const text = fillTools(fs.readFileSync(defaultConfigPath(), "utf-8"));
      fs.mkdirSync(projectDir(ctx.cwd), { recursive: true });
      fs.writeFileSync(dest, text, "utf-8");
      ctx.ui.notify(`✅ Wrote ${dest} — edit models/rules/tools per project, then restart pi.`, "info");
    },
  });
}
