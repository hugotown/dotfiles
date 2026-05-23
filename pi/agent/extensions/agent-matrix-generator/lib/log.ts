import { appendFileSync, mkdirSync } from "node:fs";
import { LOG_DIR, LOG_FILE } from "./constants";

export function log(message: string, extra?: Record<string, unknown>): void {
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    const line = `[${new Date().toISOString()}] ${message}${extra ? " " + JSON.stringify(extra) : ""}\n`;
    appendFileSync(LOG_FILE, line);
  } catch {
    // best-effort
  }
}
