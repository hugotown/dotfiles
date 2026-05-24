/** Load a local path or http(s) URL into an inline image Part. */
import { readFileSync } from "node:fs";
import { extname } from "node:path";

const MIME: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".heic": "image/heic", ".heif": "image/heif",
};

export interface InlineImage {
  inlineData: { data: string; mimeType: string };
}

function mimeForPath(path: string): string {
  return MIME[extname(path).toLowerCase()] ?? "image/png";
}

export async function loadImagePart(source: string): Promise<InlineImage> {
  if (/^https?:\/\//i.test(source)) {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status} ${res.statusText}`);
    const mimeType = res.headers.get("content-type")?.split(";")[0] ?? "image/png";
    return { inlineData: { data: Buffer.from(await res.arrayBuffer()).toString("base64"), mimeType } };
  }
  return { inlineData: { data: readFileSync(source).toString("base64"), mimeType: mimeForPath(source) } };
}
