import type { Plugin } from "@opencode-ai/plugin";
import { spawn, type ChildProcess } from "node:child_process";

export const server: Plugin = async () => {
  let child: ChildProcess | null = null;

  child = spawn("caffeinate", ["-i"], {
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

  return {};
};
