// lib/artifacts.ts — Create the per-run shared artifacts directory.
import * as fs from "node:fs";
import * as path from "node:path";

export function createArtifactsDir(home: string, id: string): string {
  const dir = path.join(home, "artifacts", id);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
