// lib/variable-sub.ts — Substitute $var, $id.output and $id.output.field tokens.
import type { SubContext } from "../runtime-types.ts";

export function substitute(template: string, ctx: SubContext): string {
  let out = template.replace(/\$([A-Za-z0-9_-]+)\.output\.([A-Za-z0-9_]+)/g, (m, id, field) => {
    const s = ctx.nodeStructured[id];
    if (s && typeof s === "object" && field in (s as object)) {
      const v = (s as Record<string, unknown>)[field];
      return v == null ? "" : String(v);
    }
    return m;
  });
  out = out.replace(/\$([A-Za-z0-9_-]+)\.output\b/g, (m, id) =>
    id in ctx.nodeOutputs ? ctx.nodeOutputs[id] : m,
  );
  out = out.replace(/\$([A-Z_]+)\b/g, (m, name) =>
    name in ctx.builtins ? ctx.builtins[name] : m,
  );
  return out;
}
