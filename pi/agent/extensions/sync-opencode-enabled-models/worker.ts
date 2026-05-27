/**
 * Detached worker for sync-opencode-enabled-models.
 *
 * Spawned by index.ts on Pi's `session_shutdown(reason="quit")` event with
 * `{ detached: true }` and `child.unref()`, so it runs after Pi has already
 * exited. All output goes to ~/.local/state/sync-opencode-enabled-models/worker.log.
 *
 * Does the actual work the extension is meant to do:
 *   1. Invoke `opencode models opencode-go` and `opencode models opencode`.
 *   2. Merge the returned model IDs into `~/.pi/agent/settings.json`'s
 *      `enabledModels` array, preserving non-managed entries.
 */
import { syncSettings } from "./lib/settings";
import { log } from "./lib/models";

log("info", "worker started");
syncSettings()
  .then(() => log("info", "worker finished"))
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    log("error", `worker failed: ${message}`);
    process.exitCode = 1;
  });
