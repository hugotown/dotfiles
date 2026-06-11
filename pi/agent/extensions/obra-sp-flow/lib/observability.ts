// Durable, project-local observability trace (separate from the pi session).
// One append-only jsonl per feature run under {cwd}/.pi/obra-sp-flow/logs. This
// is exactly what was missing the night a debug subagent hung with --no-session:
// a human-readable record of every spawn, phase, check and escalation.
//
// A module singleton keyed to the single active flow keeps call sites trivial
// (no threading through every phase). Logging never throws — a failed write must
// not break the pipeline.

import * as fs from "node:fs";
import * as path from "node:path";
import { logPath } from "./paths.ts";

export interface FlowLogger {
  readonly path: string;
  log(event: Record<string, unknown>): void;
}

let active: FlowLogger | null = null;

export function initLogger(cwd: string, idea: string): FlowLogger {
  let resolvedPath = "";
  try {
    resolvedPath = logPath(cwd, idea);
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  } catch {
    /* logging is best-effort */
  }
  active = {
    path: resolvedPath,
    log(event) {
      if (!resolvedPath) return;
      try {
        fs.appendFileSync(resolvedPath, `${JSON.stringify({ ts: new Date().toISOString(), ...event })}\n`, "utf-8");
      } catch {
        /* never let logging break the flow */
      }
    },
  };
  return active;
}

/** Log to the active flow logger, if any. Safe no-op when uninitialized. */
export function logEvent(event: Record<string, unknown>): void {
  active?.log(event);
}

export function loggerPath(): string | null {
  return active?.path ?? null;
}
