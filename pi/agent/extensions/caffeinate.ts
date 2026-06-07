import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawn, type ChildProcess } from "node:child_process";

export default function (pi: ExtensionAPI) {
  let caffeinateProcess: ChildProcess | null = null;

  pi.on("session_start", async (_event, _ctx) => {
    if (caffeinateProcess) return;

    caffeinateProcess = spawn("caffeinate", ["-i"], {
      stdio: "ignore",
      detached: false,
    });

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
