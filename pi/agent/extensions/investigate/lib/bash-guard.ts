// Pragmatic regex guard for the parent pi's built-in `bash` tool. Blocks calls
// that combine an HTTP client (curl/wget/etc.) with an EXTERNAL URL — public
// internet. Local services (localhost, 127.x, 192.168.x, 10.x, 172.16-31.x,
// 169.254.x) are intentionally allowed so local dev workflows keep working.
// The block forces the LLM toward the `investigate` tool or the `curl` tool,
// both of which enforce proxy + SSRF + truncation policy.
import type { BashGuardConfig } from "../types.ts";

const EXTERNAL_URL = /https?:\/\/(?!localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)[^\s'"]+/i;

export interface BashGuardVerdict {
  block: true;
  reason: string;
}

export function checkBashCommand(command: string, config: BashGuardConfig): BashGuardVerdict | null {
  if (!config.enabled) return null;
  if (config.block_commands.length === 0) return null;
  const cmdRe = new RegExp(`(?:^|[|&;]|\\s)(?:${config.block_commands.map(escapeRe).join("|")})\\s`, "i");
  if (!cmdRe.test(command)) return null;
  if (!EXTERNAL_URL.test(command)) return null;
  return {
    block: true,
    reason: [
      "External HTTP via bash is blocked. Use one of:",
      "  • `investigate({ pregunta, depth })` — for research (multiple sources synthesized).",
      "  • tool `curl` — for a single HTTP request.",
      "Both enforce the DataImpulse proxy, SSRF guard, and response truncation. `bash`+`curl` bypasses all of that.",
      "If you really need local-only access, the bash command stays allowed for localhost / 192.168.x / 10.x / 172.16-31.x / 169.254.x.",
    ].join("\n"),
  };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
