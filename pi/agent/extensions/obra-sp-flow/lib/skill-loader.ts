// Loads superpowers SKILL.md files fresh from disk (single source of truth) and
// wraps them for non-interactive subagent execution. The extension owns
// orchestration only; the skill text owns the "how".

import * as fs from "node:fs";
import * as path from "node:path";

function expandHome(dir: string): string {
  const home = process.env.HOME ?? "";
  if (dir.startsWith("~")) return path.join(home, dir.slice(1));
  if (dir.startsWith("$HOME")) return path.join(home, dir.slice(5));
  return dir;
}

export function skillPath(skillsDir: string, name: string): string {
  return path.join(expandHome(skillsDir), name, "SKILL.md");
}

export function loadSkill(skillsDir: string, name: string): string {
  try {
    return fs.readFileSync(skillPath(skillsDir, name), "utf-8");
  } catch {
    return "";
  }
}

const AUTONOMOUS_WRAPPER = `
## obra-sp-flow autonomous wrapper
You run NON-INTERACTIVELY as an isolated subagent. There is NO human to ask.
- Never call ask_user_question and never wait for input.
- Resolve ambiguity from the spec / plan / decisions provided. If you are truly
  blocked by missing information, stop and report BLOCKED with the reason.
- Produce ONLY the requested artifact. Be concise and exact.
- Ground every claim in the codebase: use ast-grep and read before asserting.`;

/** Skill text + autonomous wrapper, for subagent system prompts. */
export function autonomousSkill(skillsDir: string, name: string): string {
  const body = loadSkill(skillsDir, name);
  return body ? `${body}\n${AUTONOMOUS_WRAPPER}` : AUTONOMOUS_WRAPPER;
}
