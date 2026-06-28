/** Resolve the extension directory from this module's location. */
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// .../extensions/obra-sp-flow/src/config/resolve.ts -> .../extensions/obra-sp-flow
export const EXT_DIR = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
