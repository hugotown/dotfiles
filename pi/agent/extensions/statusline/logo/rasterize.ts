import * as fs from "node:fs";
import { spawnSync } from "node:child_process";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { logoPngPath, notifiedRsvgMarker } from "../lib/paths";

function rsvgAvailable(): boolean {
  const r = spawnSync("rsvg-convert", ["--version"], { stdio: "ignore" });
  return r.status === 0;
}

function notifyOnce(ctx: ExtensionContext): void {
  try {
    if (fs.existsSync(notifiedRsvgMarker())) return;
    ctx.ui.notify("Install librsvg for provider logos: brew install librsvg", "info");
    fs.writeFileSync(notifiedRsvgMarker(), "");
  } catch {
    /* ignore */
  }
}

export async function rasterizeLogo(svgPath: string, modelsDevProvider: string, ctx: ExtensionContext): Promise<string | null> {
  const out = logoPngPath(modelsDevProvider);
  if (fs.existsSync(out)) return out;
  if (!rsvgAvailable()) {
    notifyOnce(ctx);
    return null;
  }
  const r = spawnSync("rsvg-convert", ["--width=32", "--height=32", "--output", out, svgPath], { stdio: "ignore" });
  return r.status === 0 && fs.existsSync(out) ? out : null;
}
