import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";

export const CACHE_ROOT = path.join(os.homedir(), ".pi", "cache", "model-meta");
export const catalogPath = () => path.join(CACHE_ROOT, "catalog.json");
export const equivalencesPath = () => path.join(CACHE_ROOT, "equivalences.json");
export const logosDir = () => path.join(CACHE_ROOT, "logos");
export const logoSvgPath = (p: string) => path.join(logosDir(), `${p}.svg`);
export const logoPngPath = (p: string) => path.join(logosDir(), `${p}.png`);
export const notifiedRsvgMarker = () => path.join(CACHE_ROOT, ".notified-rsvg");

export function ensureCacheDirs(): void {
  fs.mkdirSync(logosDir(), { recursive: true });
}