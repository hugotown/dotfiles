import type { Plugin } from "@opencode-ai/plugin";
import { spawn, type ChildProcess } from "node:child_process";

export const server: Plugin = async () => {
  let child: ChildProcess | null = null;

  // -d display, -i idle system, -m disk, -s system (AC), -u declare user active
  // -w PID: caffeinate exits automatically when this process exits, so even a
  // SIGKILL of opencode cannot leave an orphan asserting "forever".
  child = spawn("caffeinate", ["-dimsu", "-w", String(process.pid)], {
    stdio: "ignore",
  });

  const cleanup = () => {
    if (child && !child.killed) {
      child.kill("SIGTERM");
      child = null;
    }
  };

  process.on("exit", cleanup);
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  process.on("SIGHUP", cleanup);

  return {};
};
