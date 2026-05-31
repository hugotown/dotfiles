// Project tree building and graphify detection.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { dirExists } from "../utils.ts";

export async function buildProjectTree(pi: ExtensionAPI, cwd: string): Promise<string> {
  const tree = await pi.exec(
    "eza",
    ["--tree", "--level=5", "-I", "node_modules|.git|dist|build|coverage|target|.venv|__pycache__|.next|.turbo"],
    { cwd },
  );
  if (tree.code !== 0 || !tree.stdout.trim()) return "(no tree available)";
  return tree.stdout.length > 8000 ? tree.stdout.slice(0, 8000) + "\n... (truncated)" : tree.stdout;
}

export async function hasGraphify(pi: ExtensionAPI, cwd: string): Promise<boolean> {
  return dirExists(pi, cwd, "graphify-out");
}
