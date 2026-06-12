// lib/retry.ts — Error classification + retry wrapper with exponential backoff.
import type { RetryConfig } from "../types.ts";

export function classifyError(e: string): "fatal" | "transient" | "unknown" {
  const s = e.toLowerCase();
  if (/auth|permission denied|credit|unauthorized|forbidden/.test(s)) return "fatal";
  if (/exited with code|rate limit|timeout|network|econn|socket/.test(s)) return "transient";
  return "unknown";
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  cfg: RetryConfig | undefined,
  isRetryable: (kind: "fatal" | "transient" | "unknown") => boolean,
): Promise<T> {
  const max = Math.min(Math.max(cfg?.max_attempts ?? 2, 1), 5);
  const base = Math.min(Math.max(cfg?.delay_ms ?? 3000, 1000), 60000);
  let lastErr: unknown;
  for (let attempt = 0; attempt <= max; attempt++) {
    try { return await fn(); } catch (e) {
      lastErr = e;
      const kind = classifyError(e instanceof Error ? e.message : String(e));
      if (kind === "fatal" || !isRetryable(kind) || attempt === max) break;
      await new Promise((r) => setTimeout(r, base * 2 ** attempt));
    }
  }
  throw lastErr;
}
