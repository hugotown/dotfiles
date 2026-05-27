/* ============================================================================
 *  WORK IN PROGRESS — EXTENSION DISABLED
 * ============================================================================
 *
 *  This extension (agent-matrix-generator) is intentionally disabled.
 *
 *  WHY DISABLED:
 *    - It used to generate ~472 derived agent markdown files at
 *      ~/.pi/agent/agents/ — one per (role × provider × model) tuple.
 *    - That output is currently considered noise: the generated agents
 *      were not being used in practice and they cluttered the agents
 *      directory, hiding the handcrafted ones (build.md, plan.md).
 *    - All previously generated files have been removed.
 *
 *  WHAT THIS FILE DOES NOW:
 *    - Exports a no-op default function so the Pi extension loader keeps
 *      working without errors.
 *    - Does NOT register any event handler, command, or background worker.
 *    - Does NOT touch the filesystem.
 *
 *  TO RE-ENABLE (when this is no longer WIP):
 *    1. Decide which roles and providers the matrix should still cover —
 *       the old logic generated a file per (role × provider × model) and
 *       that explosion is what made the output unmanageable.
 *    2. Restore the original implementation by reverting to the prior
 *       index.ts (see git history) OR rewrite it with a tighter scope
 *       (e.g. only generate matrix for a specific role on demand via a
 *       slash command instead of on every shutdown).
 *    3. Re-test the shutdown path: the previous version spawned a
 *       detached "bun regenerator.ts" worker with stdio piped to a log
 *       file and called child.unref() so Pi did not block on quit —
 *       any rewrite must preserve that property.
 *    4. Remove this banner.
 *
 *  PRESERVED ON DISK (NOT TOUCHED BY THIS DISABLE):
 *    - lib/                  → original helpers (capabilities, providers,
 *                              requirements, source-parser, markdown,
 *                              cleanup, log, constants).
 *    - regenerator.ts        → original detached worker entry point.
 *    - types.ts              → original type declarations.
 *    These are kept so the future rewrite has a starting point.
 *
 * ========================================================================= */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (_pi: ExtensionAPI) {
  // Intentionally empty. See banner above.
}
