import * as fs from "node:fs";
import * as https from "node:https";
import { ensureCacheDirs, logoSvgPath } from "../lib/paths";

export async function ensureLogoSvg(modelsDevProvider: string): Promise<string | null> {
  ensureCacheDirs();
  const target = logoSvgPath(modelsDevProvider);
  if (fs.existsSync(target)) return target;

  return new Promise((resolve) => {
    const url = `https://models.dev/logos/${encodeURIComponent(modelsDevProvider)}.svg`;
    const req = https.get(url, { timeout: 10_000 }, (res) => {
      if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        resolve(null);
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        try {
          const tmp = `${target}.tmp`;
          fs.writeFileSync(tmp, Buffer.concat(chunks));
          fs.renameSync(tmp, target);
          resolve(target);
        } catch {
          resolve(null);
        }
      });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}
