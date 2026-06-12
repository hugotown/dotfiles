// lib/condition-eval.ts — Safe when: evaluator. ops: == != > < >= <= && ||. Fail-closed.
import type { SubContext } from "../runtime-types.ts";
import { substitute } from "./variable-sub.ts";

const unquote = (s: string) => s.replace(/^['"]|['"]$/g, "");

function cmp(a: string, op: string, b: string): boolean {
  const na = Number(a), nb = Number(b);
  const num = a.trim() !== "" && b.trim() !== "" && !Number.isNaN(na) && !Number.isNaN(nb);
  switch (op) {
    case "==": return a === b;
    case "!=": return a !== b;
    case ">": return num && na > nb;
    case "<": return num && na < nb;
    case ">=": return num && na >= nb;
    case "<=": return num && na <= nb;
    default: return false;
  }
}

function atom(expr: string, ctx: SubContext): boolean {
  const m = expr.match(/^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (!m) return false;
  return cmp(unquote(substitute(m[1].trim(), ctx)), m[2], unquote(substitute(m[3].trim(), ctx)));
}

export function evaluateCondition(expr: string, ctx: SubContext): boolean {
  try {
    return expr.split("||").some((or) => or.split("&&").every((a) => atom(a.trim(), ctx)));
  } catch {
    return false;
  }
}
