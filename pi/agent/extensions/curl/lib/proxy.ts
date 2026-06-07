// Reads proxy credentials from the env-var names configured in config.yml and
// builds an http://user:pass@host:port URL for curl --proxy.
// Returns null when any required env var is missing — callers decide whether to
// throw MissingProxyEnvError or proceed (allow_private:true bypasses this).
import type { CurlConfig } from "../types.ts";

export interface ProxyResult {
  url: string | null;
  missing: string[];
}

export function buildProxyUrl(config: CurlConfig): ProxyResult {
  const p = config.proxy;
  const login = process.env[p.login_env];
  const password = process.env[p.password_env];
  const host = process.env[p.host_env];
  const port = process.env[p.port_env];
  const missing: string[] = [];
  if (!login) missing.push(p.login_env);
  if (!password) missing.push(p.password_env);
  if (!host) missing.push(p.host_env);
  if (!port) missing.push(p.port_env);
  if (missing.length > 0) return { url: null, missing };
  return {
    url: `http://${encodeURIComponent(login!)}:${encodeURIComponent(password!)}@${host}:${port}`,
    missing: [],
  };
}