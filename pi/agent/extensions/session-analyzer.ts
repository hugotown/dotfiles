// session-analyzer — keeps the `python3 -m session_analyzer` background
// process alive across pi sessions. Mirrors the opencode plugin at
// /Users/hugoruiz/.config/opencode/plugins/session-analyzer.ts.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawn, execSync } from "node:child_process";

const SESSION_ANALYZER_DIR =
  "/Users/hugoruiz/.config/agent-tools/session-analyzer/src";

function isAlreadyRunning(): boolean {
  try {
    const out = execSync(`pgrep -f "python3 -m session_analyzer"`, {
      encoding: "utf-8",
    });
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async () => {
    if (isAlreadyRunning()) return;

    const child = spawn("python3", ["-m", "session_analyzer"], {
      cwd: SESSION_ANALYZER_DIR,
      detached: true,
      stdio: "ignore",
    });
    child.unref();
  });
}
