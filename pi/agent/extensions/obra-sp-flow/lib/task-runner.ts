// Detects a task runner (mise / just / make) command for a named task, ONLY
// when the manifest actually defines that task — so we never emit a command that
// would fail just because the task is absent.

import * as fs from "node:fs";
import * as path from "node:path";

function read(cwd: string, file: string): string | null {
  try {
    return fs.readFileSync(path.join(cwd, file), "utf-8");
  } catch {
    return null;
  }
}

export function taskRunner(cwd: string, task: string): string {
  const mise = read(cwd, "mise.toml") ?? read(cwd, ".mise.toml") ?? read(cwd, ".config/mise/config.toml");
  if (mise && new RegExp(`\\[tasks\\.${task}\\]|^\\s*${task}\\s*=`, "m").test(mise)) return `mise run ${task}`;

  const just = read(cwd, "justfile") ?? read(cwd, "Justfile");
  if (just && new RegExp(`^${task}\\s*:`, "m").test(just)) return `just ${task}`;

  const make = read(cwd, "Makefile") ?? read(cwd, "makefile");
  if (make && new RegExp(`^${task}\\s*:`, "m").test(make)) return `make ${task}`;

  return "";
}
