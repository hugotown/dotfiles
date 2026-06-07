import * as fs from "node:fs";
import type { CatalogFile } from "../types";
import { catalogPath, ensureCacheDirs } from "../lib/paths";

export function readCatalog(): CatalogFile | null {
  try {
    const raw = fs.readFileSync(catalogPath(), "utf8");
    const parsed = JSON.parse(raw) as CatalogFile;
    if (!parsed || typeof parsed.lastSync !== "string" || !parsed.data) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCatalog(file: CatalogFile): void {
  ensureCacheDirs();
  const tmp = `${catalogPath()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(file));
  fs.renameSync(tmp, catalogPath());
}
