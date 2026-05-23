import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { OUTPUT_DIR } from "./constants";
import { log } from "./log";
import { listGeneratedFiles } from "./source-parser";

/** Remove generated files that are no longer expected. Returns count deleted. */
export function cleanupStaleFiles(expected: Set<string>): number {
  let deleted = 0;
  for (const file of listGeneratedFiles()) {
    if (expected.has(file)) continue;
    try {
      unlinkSync(join(OUTPUT_DIR, file));
      deleted++;
    } catch (err) {
      log("failed to delete stale generated file", { file, error: String(err) });
    }
  }
  return deleted;
}
