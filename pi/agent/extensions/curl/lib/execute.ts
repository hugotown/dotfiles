import { spawn } from "node:child_process";
import {
  type CurlConfig,
  CurlExitError,
  type CurlInput,
  type CurlSuccess,
  JsonParseError,
  MissingProxyEnvError,
  TimeoutError,
} from "../types.ts";
import { buildCurlArgs } from "./curl-args.ts";
import { parseCurlStdout } from "./curl-parse.ts";
import { buildProxyUrl } from "./proxy.ts";
import { assertNotPrivate } from "./ssrf-guard.ts";
import { softTruncate } from "./truncate.ts";

function runCurl(args: string[], signal: AbortSignal | undefined, timeoutSeconds: number, maxDownloadBytes: number | undefined): Promise<{ stdout: Buffer; stderr: string; exitCode: number; aborted: boolean; truncatedBySize: boolean }> {
  return new Promise((resolve) => {
    const proc = spawn("curl", args, { shell: false, stdio: ["ignore", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let stderr = "";
    let aborted = false;
    let truncatedBySize = false;
    let finished = false;

    proc.stdout.on("data", (d: Buffer) => {
      if (finished) return;
      if (maxDownloadBytes !== undefined && totalBytes + d.byteLength > maxDownloadBytes) {
        // Cap: take only what fits, then kill
        const remaining = maxDownloadBytes - totalBytes;
        if (remaining > 0) chunks.push(d.subarray(0, remaining));
        truncatedBySize = true;
        finished = true;
        proc.kill("SIGKILL");
        return;
      }
      chunks.push(d);
      totalBytes += d.byteLength;
    });
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString("utf-8"); });
    proc.on("close", (code) => {
      resolve({ stdout: Buffer.concat(chunks), stderr, exitCode: code ?? 0, aborted, truncatedBySize });
    });
    proc.on("error", () => resolve({ stdout: Buffer.concat(chunks), stderr, exitCode: 1, aborted, truncatedBySize }));
    if (signal) {
      const kill = () => { aborted = true; proc.kill("SIGTERM"); setTimeout(() => !proc.killed && proc.kill("SIGKILL"), 2000); };
      signal.aborted ? kill() : signal.addEventListener("abort", kill, { once: true });
    }
    setTimeout(() => { if (!proc.killed) { aborted = true; proc.kill("SIGKILL"); } }, (timeoutSeconds + 5) * 1000);
  });
}

export async function executeCurl(input: CurlInput, config: CurlConfig, signal?: AbortSignal): Promise<CurlSuccess> {
  await assertNotPrivate(input.url, input.allow_private ?? false, config.ssrf.extra_blocked_hosts);

  let proxyUrl: string | null = null;
  if (!input.allow_private) {
    const proxy = buildProxyUrl(config);
    if (!proxy.url) throw new MissingProxyEnvError(proxy.missing);
    proxyUrl = proxy.url;
  }

  const args = buildCurlArgs(input, proxyUrl, config);
  const timeout = input.timeout_seconds ?? config.defaults.timeout_seconds;
  const maxKb = input.max_size_kb ?? config.defaults.max_size_kb;
  const { stdout, stderr, exitCode, aborted, truncatedBySize } = await runCurl(args, signal, timeout, maxKb * 1024 * 2);

  if (aborted) throw new CurlExitError(exitCode, stderr || "aborted");
  if (exitCode === 28) throw new TimeoutError(timeout);
  if (exitCode !== 0 && !truncatedBySize) throw new CurlExitError(exitCode, stderr);

  const parsed = parseCurlStdout(stdout);
  const trunc = softTruncate(parsed.body, maxKb);

  let text = trunc.text;
  if (input.return_format === "json") {
    try { JSON.parse(text); } catch { throw new JsonParseError(text); }
  } else if (input.return_format === "headers_only") {
    text = Object.entries(parsed.headers).map(([k, v]) => `${k}: ${v}`).join("\n");
  }

  return {
    text,
    details: {
      status_code: parsed.status_code,
      status_text: parsed.status_text,
      headers: parsed.headers,
      final_url: parsed.final_url || input.url,
      redirected: parsed.redirected,
      response_time_ms: parsed.response_time_ms,
      size_bytes: parsed.size_bytes,
      truncated: trunc.truncated || truncatedBySize,
      via_proxy: proxyUrl !== null,
    },
  };
}
