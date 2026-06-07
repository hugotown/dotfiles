// Loads curl/config.yml into a typed CurlConfig. Each scalar can be a literal,
// "$ENV_VAR", or "$ENV_VAR:fallback". After substitution, numeric and boolean
// fields are coerced and ranges are validated. Throws with the field path on
// any failure so misconfigurations surface loudly at load time, not mid-request.
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import type { CurlConfig } from "../types.ts";

const ENV_REF = /^\$([A-Z_][A-Z0-9_]*)(?::(.*))?$/s;

/** Public for tests: resolve a single scalar value through the $VAR:default rule. */
export function resolveValue<T>(value: T): T | string {
  if (typeof value !== "string") return value;
  const m = value.match(ENV_REF);
  if (!m) return value;
  const [, name, fallback] = m;
  const fromEnv = process.env[name];
  if (fromEnv !== undefined) return fromEnv;
  if (fallback !== undefined) return fallback;
  // Leave the literal "$VAR" so validateConfig can report the field path.
  return value;
}

function coerceNumber(field: string, raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    if (raw.startsWith("$")) throw new Error(`Config field "${field}": unresolved env reference ${raw}. Set it or provide a $VAR:default fallback.`);
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) throw new Error(`Config field "${field}": expected a positive number, got ${JSON.stringify(raw)}.`);
    return n;
  }
  throw new Error(`Config field "${field}": expected a number, got ${typeof raw}.`);
}

function coerceBoolean(field: string, raw: unknown): boolean {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") {
    if (raw.startsWith("$")) throw new Error(`Config field "${field}": unresolved env reference ${raw}.`);
    const s = raw.toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }
  throw new Error(`Config field "${field}": expected "true" or "false", got ${JSON.stringify(raw)}.`);
}

function coerceString(field: string, raw: unknown): string {
  if (typeof raw !== "string") throw new Error(`Config field "${field}": expected a string, got ${typeof raw}.`);
  if (raw.startsWith("$")) throw new Error(`Config field "${field}": unresolved env reference ${raw}.`);
  if (raw.length === 0) throw new Error(`Config field "${field}": expected non-empty string.`);
  return raw;
}

function deepResolve(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(deepResolve);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = deepResolve(v);
    return out;
  }
  return resolveValue(value as never);
}

export function validateConfig(raw: unknown): CurlConfig {
  const r = raw as Record<string, Record<string, unknown>>;
  if (!r?.defaults || !r?.ssrf || !r?.proxy) throw new Error("Config missing required sections: defaults, ssrf, proxy.");
  const extraHosts = r.ssrf.extra_blocked_hosts;
  if (!Array.isArray(extraHosts)) throw new Error('Config field "ssrf.extra_blocked_hosts": expected array.');
  return {
    defaults: {
      timeout_seconds: coerceNumber("defaults.timeout_seconds", r.defaults.timeout_seconds),
      max_size_kb: coerceNumber("defaults.max_size_kb", r.defaults.max_size_kb),
      follow_redirects: coerceBoolean("defaults.follow_redirects", r.defaults.follow_redirects),
      user_agent: coerceString("defaults.user_agent", r.defaults.user_agent),
    },
    ssrf: { extra_blocked_hosts: extraHosts.map((h, i) => coerceString(`ssrf.extra_blocked_hosts[${i}]`, h)) },
    proxy: {
      login_env: coerceString("proxy.login_env", r.proxy.login_env),
      password_env: coerceString("proxy.password_env", r.proxy.password_env),
      host_env: coerceString("proxy.host_env", r.proxy.host_env),
      port_env: coerceString("proxy.port_env", r.proxy.port_env),
    },
  };
}

export function parseConfig(yamlText: string): CurlConfig {
  const raw = parseYaml(yamlText) ?? {};
  return validateConfig(deepResolve(raw));
}

let cached: CurlConfig | null = null;
export function getConfig(): CurlConfig {
  if (cached) return cached;
  const path = fileURLToPath(new URL("../config.yml", import.meta.url));
  cached = parseConfig(fs.readFileSync(path, "utf-8"));
  return cached;
}

/** Test-only: reset the cache so tests can re-load with mutated env. */
export function _resetConfigCache(): void {
  cached = null;
}
