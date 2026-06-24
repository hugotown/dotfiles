import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawn, type ChildProcess } from "node:child_process";

export default function (pi: ExtensionAPI) {
  let caffeinateProcess: ChildProcess | null = null;

  pi.on("session_start", async (_event, _ctx) => {
    if (caffeinateProcess) return;

    // -d display, -i idle system, -m disk, -s system (AC), -u declare user active.
    // -w PID makes caffeinate exit automatically when this process exits, so even
    // a crash/SIGKILL cannot leave an orphan asserting "forever".
    caffeinateProcess = spawn(
      "caffeinate",
      ["-dimsu", "-w", String(process.pid)],
      {
        stdio: "ignore",
        detached: false,
      },
    );

    caffeinateProcess.on("error", () => {
      caffeinateProcess = null;
    });

    caffeinateProcess.on("exit", () => {
      caffeinateProcess = null;
    });
  });

  pi.on("session_shutdown", async () => {
    if (caffeinateProcess) {
      caffeinateProcess.kill("SIGTERM");
      caffeinateProcess = null;
    }
  });
}
