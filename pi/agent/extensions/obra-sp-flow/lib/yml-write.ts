// Writes LLM-resolved check commands back into the project yml, PRESERVING all
// existing content and comments (uses the yaml document model, not parse+dump),
// and annotates each written value with a provenance comment so a human can see
// what the machine decided and override it.

import * as fs from "node:fs";
import * as path from "node:path";
import { parseDocument } from "yaml";
import type { CheckName } from "./resolve-checks.ts";

interface PairLike {
  key: unknown;
  value?: { comment?: string };
}
interface MapLike {
  items?: PairLike[];
}

export function persistResolvedChecks(
  ymlPath: string,
  resolved: Partial<Record<CheckName, string>>,
  dateIso: string = new Date().toISOString().slice(0, 10),
): void {
  const entries = Object.entries(resolved).filter(([, v]) => Boolean(v));
  if (!entries.length) return;

  let text = "";
  try {
    text = fs.readFileSync(ymlPath, "utf-8");
  } catch {
    /* file may not exist yet — start from an empty checks map */
  }
  const doc = parseDocument(text || "checks:\n");
  // Ensure a checks map exists even if the file had `checks:` (null) or no key
  // (setIn cannot descend into a null scalar).
  if (doc.getIn(["checks"]) == null) doc.set("checks", doc.createNode({}));

  for (const [name, cmd] of entries) {
    doc.setIn(["checks", name], cmd);
    const checksNode = doc.get("checks", true) as MapLike | undefined;
    const pair = checksNode?.items?.find((i) => String(i.key) === name);
    if (pair?.value) pair.value.comment = ` auto-detected by LLM ${dateIso}`;
  }

  fs.mkdirSync(path.dirname(ymlPath), { recursive: true });
  fs.writeFileSync(ymlPath, doc.toString(), "utf-8");
}
