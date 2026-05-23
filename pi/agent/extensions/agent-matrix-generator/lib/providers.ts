import { spawnSync } from "node:child_process";
import { FETCH_TIMEOUT_MS } from "./constants";
import { log } from "./log";

export function fetchProviderModels(providerId: string): string[] {
  const result = spawnSync("opencode", ["models", providerId], {
    encoding: "utf8",
    timeout: FETCH_TIMEOUT_MS,
    env: process.env,
  });
  if (result.error) {
    log("opencode models failed", { providerId, error: String(result.error) });
    return [];
  }
  if (result.status !== 0) {
    log("opencode models exit non-zero", {
      providerId,
      status: result.status,
      stderr: result.stderr?.slice(0, 200),
    });
    return [];
  }
  const prefix = `${providerId}/`;
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith(prefix))
    .map((line) => line.slice(prefix.length))
    .sort();
}
