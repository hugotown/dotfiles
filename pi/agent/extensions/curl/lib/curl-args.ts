// Pure: builds the argv array for spawn("curl", argv, {shell:false}).
// Args-as-array prevents command injection (no shell expansion). The order is
// stable: global flags first (silent, max-time, proxy, UA, redirect, auth),
// then per-call (-H, -u, body/form, -D/-o, -w), URL last. The metadata trailer
// (-w) prints a single line `<status>|<final_url>|<time>|<size>` after the body.
import type { CurlConfig, CurlInput } from "../types.ts";

const WRITE_OUT = "\n__CURL_META__%{http_code}|%{url_effective}|%{time_total}|%{size_download}\n";

function appendQuery(url: string, query: Record<string, string> | undefined): string {
  if (!query || Object.keys(query).length === 0) return url;
  const u = new URL(url);
  for (const [k, v] of Object.entries(query)) u.searchParams.append(k, v);
  return u.toString();
}

export function buildCurlArgs(input: CurlInput, proxyUrl: string | null, config: CurlConfig): string[] {
  const args: string[] = [];
  args.push("--silent", "--show-error");

  const timeout = input.timeout_seconds ?? config.defaults.timeout_seconds;
  args.push("--max-time", String(timeout));

  const maxKb = input.max_size_kb ?? config.defaults.max_size_kb;
  args.push("--max-filesize", String(maxKb * 1024 * 2));

  if (proxyUrl) args.push("--proxy", proxyUrl);

  args.push("-A", config.defaults.user_agent);

  const followRedirects = input.follow_redirects ?? config.defaults.follow_redirects;
  if (followRedirects) args.push("-L", "--max-redirs", "5");

  if (input.ignore_ssl) args.push("-k");

  // Method: HEAD uses -I (curl convention); others use -X.
  const method = input.method ?? "GET";
  if (method === "HEAD") args.push("-I");
  else if (method !== "GET") args.push("-X", method);

  // Headers
  if (input.headers) {
    for (const [k, v] of Object.entries(input.headers)) args.push("-H", `${k}: ${v}`);
  }

  // Cookies → single Cookie header
  if (input.cookies && Object.keys(input.cookies).length > 0) {
    const cookieStr = Object.entries(input.cookies).map(([k, v]) => `${k}=${v}`).join("; ");
    args.push("-H", `Cookie: ${cookieStr}`);
  }

  // Basic auth
  if (input.basic_auth) args.push("-u", `${input.basic_auth.user}:${input.basic_auth.pass}`);

  // Body: form wins over body (mutually exclusive per spec). Object body → JSON.
  if (input.form && Object.keys(input.form).length > 0) {
    for (const [k, v] of Object.entries(input.form)) args.push("--data-urlencode", `${k}=${v}`);
  } else if (input.body !== undefined) {
    if (typeof input.body === "string") {
      args.push("--data-raw", input.body);
    } else {
      args.push("-H", "Content-Type: application/json", "--data-raw", JSON.stringify(input.body));
    }
  }

  // Output: dump headers (-D) and body (-o) to stdout, then -w metadata trailer.
  args.push("-D", "-", "-o", "-", "-w", WRITE_OUT);

  // URL (with merged query) goes LAST.
  args.push(appendQuery(input.url, input.query));
  return args;
}
