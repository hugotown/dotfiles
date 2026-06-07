import { lookup as nodeLookup } from "node:dns/promises";
import { InvalidUrlError, SsrfBlockedError } from "../types.ts";

const HOST_BLOCKLIST = new Set(["localhost", "ip6-localhost", "ip6-loopback", "metadata.google.internal"]);

const PRIVATE_IPV4 = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
];
const PRIVATE_IPV6 = [/^::1$/i, /^fe80:/i, /^fc[0-9a-f]{2}:/i, /^fd[0-9a-f]{2}:/i];

export function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) return PRIVATE_IPV6.some((re) => re.test(ip));
  return PRIVATE_IPV4.some((re) => re.test(ip));
}

export function isBlockedHostname(host: string, extraBlocked: string[]): boolean {
  const lower = host.toLowerCase();
  if (HOST_BLOCKLIST.has(lower)) return true;
  return extraBlocked.some((b) => b.toLowerCase() === lower);
}

export type LookupFn = (host: string) => Promise<{ address: string; family: 4 | 6 }>;

export async function assertNotPrivate(
  rawUrl: string,
  allowPrivate: boolean,
  extraBlocked: string[],
  lookup: LookupFn = nodeLookup as LookupFn,
): Promise<void> {
  if (allowPrivate) return;

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new InvalidUrlError(rawUrl, "could not be parsed");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new InvalidUrlError(rawUrl, `protocol "${parsed.protocol}" not allowed (only http/https)`);
  }

  const host = parsed.hostname.replace(/^\[|\]$/g, "");

  if (isBlockedHostname(host, extraBlocked)) throw new SsrfBlockedError(host);

  if (/^[0-9a-f:.]+$/i.test(host) && (host.includes(":") || /^\d/.test(host))) {
    if (isPrivateIp(host)) throw new SsrfBlockedError(host);
    return;
  }

  let resolved: { address: string };
  try {
    resolved = await lookup(host);
  } catch {
    return;
  }
  if (isPrivateIp(resolved.address)) throw new SsrfBlockedError(host, resolved.address);
}
