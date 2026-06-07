import * as https from "node:https";
import type { CatalogData } from "../types";

export async function fetchCatalog(): Promise<CatalogData> {
  return new Promise((resolve, reject) => {
    const req = https.get("https://models.dev/api.json", { timeout: 10_000 }, (res) => {
      if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        reject(new Error(`models.dev returned HTTP ${res.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          resolve(parsed as CatalogData);
        } catch (err) {
          reject(new Error(`models.dev parse error: ${(err as Error).message}`));
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(new Error("models.dev fetch timeout")); });
  });
}
