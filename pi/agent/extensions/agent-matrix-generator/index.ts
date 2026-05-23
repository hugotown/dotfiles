/**
 * agent-matrix-generator — Pi extension entry point.
 *
 * For every canonical role prompt at `~/.config/agents/agents/*.md`, generates
 * one derived Pi agent markdown file per (provider, model) tuple whose model
 * satisfies the role's capability requirements.
 *
 * Triggers (both detached so Pi never blocks on us):
 *   - factory time: if no generated files exist, spawn bootstrap worker.
 *   - session_shutdown(reason="quit"): spawn regenerator for next session.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawn } from "node:child_process";
import { mkdirSync, openSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LOG_DIR, LOG_FILE, REGEN_FLAG } from "./lib/constants";
import { log } from "./lib/log";
import { listGeneratedFiles } from "./lib/source-parser";

function spawnDetachedWorker(): void {
  try {
    const scriptPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "regenerator.ts",
    );
    mkdirSync(LOG_DIR, { recursive: true });
    const fd = openSync(LOG_FILE, "a");
    const child = spawn("bun", [scriptPath, REGEN_FLAG], {
      detached: true,
      stdio: ["ignore", fd, fd],
      env: process.env,
      cwd: dirname(scriptPath),
    });
    child.unref();
    log("spawned detached regenerator", { pid: child.pid });
  } catch (err) {
    log("failed to spawn regenerator", { error: String(err) });
  }
}

export default function (pi: ExtensionAPI) {
  if (listGeneratedFiles().length === 0) {
    log("no generated files found at factory time; spawning bootstrap worker");
    spawnDetachedWorker();
  }

  pi.on("session_shutdown", (event: { reason?: string }) => {
    if (event.reason !== "quit") return;
    log("session_shutdown quit; spawning detached regenerator");
    spawnDetachedWorker();
  });
}
