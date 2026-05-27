import { spawn } from "node:child_process";

export const PROVIDERS = ["opencode-go", "opencode"] as const;
export type SyncedProvider = (typeof PROVIDERS)[number];

export function log(level: "info" | "warn" | "error", message: string): void {
  const ts = new Date().toISOString();
  console.error(`[sync-opencode-enabled-models] ${ts} ${level.toUpperCase()} ${message}`);
}

export function runOpencodeModels(provider: SyncedProvider): Promise<string[]> {
  return new Promise((resolve) => {
    log("info", `fetching available model IDs for provider '${provider}' via 'opencode models ${provider}'`);
    const child = spawn("opencode", ["models", provider], {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c: Buffer) => (stdout += c.toString("utf8")));
    child.stderr.on("data", (c: Buffer) => (stderr += c.toString("utf8")));

    child.on("error", (err) => {
      log("warn", `could not spawn 'opencode models ${provider}': ${err.message}`);
      resolve([]);
    });

    child.on("exit", (code) => {
      if (code !== 0) {
        log("warn", `'opencode models ${provider}' exited with code ${code}; stderr=${stderr.slice(0, 200)}`);
        resolve([]);
        return;
      }
      const prefix = `${provider}/`;
      const ids = stdout.split("\n").map((l) => l.trim()).filter((l) => l.startsWith(prefix));
      log("info", `provider '${provider}' returned ${ids.length} available model IDs`);
      resolve(ids);
    });
  });
}
