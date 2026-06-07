// Public type contracts for the curl extension. Imported by lib/schema.ts,
// lib/execute.ts, lib/settings.ts, and index.ts. Other extensions MUST NOT import
// from here (zero cross-extension imports, per extensions/README.md).

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
export type ReturnFormat = "text" | "json" | "headers_only";

/** Caller-supplied parameters for one curl invocation. Mirrors lib/schema.ts. */
export interface CurlInput {
  url: string;
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: string | Record<string, unknown>;
  query?: Record<string, string>;
  form?: Record<string, string>;
  basic_auth?: { user: string; pass: string };
  cookies?: Record<string, string>;
  follow_redirects?: boolean;
  timeout_seconds?: number;
  max_size_kb?: number;
  ignore_ssl?: boolean;
  allow_private?: boolean;
  return_format?: ReturnFormat;
}

export interface CurlDetails {
  status_code: number;
  status_text: string;
  headers: Record<string, string>;
  final_url: string;
  redirected: boolean;
  response_time_ms: number;
  size_bytes: number;
  truncated: boolean;
  via_proxy: boolean;
}

export interface CurlSuccess {
  text: string;
  details: CurlDetails;
}

/** Configuration loaded from config.yml after env substitution + coercion. */
export interface CurlConfig {
  defaults: {
    timeout_seconds: number;
    max_size_kb: number;
    follow_redirects: boolean;
    user_agent: string;
  };
  ssrf: { extra_blocked_hosts: string[] };
  proxy: {
    login_env: string;
    password_env: string;
    host_env: string;
    port_env: string;
  };
}

export class MissingProxyEnvError extends Error {
  constructor(missing: string[]) {
    super(`Missing proxy env vars: ${missing.join(", ")}. Set them or pass allow_private:true to bypass the proxy.`);
    this.name = "MissingProxyEnvError";
  }
}
export class SsrfBlockedError extends Error {
  constructor(host: string, resolved?: string) {
    super(`SSRF blocked: ${host}${resolved ? ` (resolved to ${resolved})` : ""}. Pass allow_private:true to override.`);
    this.name = "SsrfBlockedError";
  }
}
export class InvalidUrlError extends Error {
  constructor(url: string, reason: string) {
    super(`Invalid URL "${url}": ${reason}`);
    this.name = "InvalidUrlError";
  }
}
export class CurlExitError extends Error {
  constructor(exitCode: number, stderr: string) {
    super(`curl exited with code ${exitCode}: ${stderr.trim() || "(no stderr)"}`);
    this.name = "CurlExitError";
  }
}
export class TimeoutError extends Error {
  constructor(seconds: number) {
    super(`curl exceeded --max-time ${seconds}s`);
    this.name = "TimeoutError";
  }
}
export class JsonParseError extends Error {
  constructor(snippet: string) {
    super(`return_format:json requested but body is not valid JSON. Snippet: ${snippet.slice(0, 200)}`);
    this.name = "JsonParseError";
  }
}
