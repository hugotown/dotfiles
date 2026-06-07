import { describe, expect, test } from "bun:test";
import { buildCurlArgs } from "../lib/curl-args.ts";
import type { CurlConfig, CurlInput } from "../types.ts";

const baseConfig: CurlConfig = {
  defaults: { timeout_seconds: 30, max_size_kb: 500, follow_redirects: true, user_agent: "TestUA/1.0" },
  ssrf: { extra_blocked_hosts: [] },
  proxy: { login_env: "DI_LOGIN", password_env: "DI_SEC", host_env: "DI_HOST", port_env: "DI_PORT" },
};

const PROXY = "http://u:p@proxy:823";

function build(input: CurlInput, proxyUrl: string | null = PROXY, config = baseConfig) {
  return buildCurlArgs(input, proxyUrl, config);
}

describe("buildCurlArgs", () => {
  test("basic GET with proxy + UA + redirects + timeout + max-filesize", () => {
    const args = build({ url: "https://example.com" });
    expect(args).toContain("--proxy");
    expect(args).toContain(PROXY);
    expect(args).toContain("-A");
    expect(args).toContain("TestUA/1.0");
    expect(args).toContain("-L");
    expect(args).toContain("--max-redirs");
    expect(args).toContain("5");
    expect(args).toContain("--max-time");
    expect(args).toContain("30");
    expect(args).toContain("--max-filesize");
    expect(args).toContain(String(500 * 1024 * 2));
    expect(args[args.length - 1]).toBe("https://example.com");
  });

  test("no --proxy when proxyUrl is null (allow_private)", () => {
    const args = build({ url: "http://192.168.1.1", allow_private: true }, null);
    expect(args).not.toContain("--proxy");
  });

  test("POST with method flag", () => {
    const args = build({ url: "https://e.com", method: "POST" });
    expect(args).toContain("-X");
    expect(args).toContain("POST");
  });

  test("custom headers passed via -H", () => {
    const args = build({ url: "https://e.com", headers: { "X-Foo": "bar", "Accept": "application/json" } });
    expect(args.filter((a) => a === "-H")).toHaveLength(2);
    expect(args).toContain("X-Foo: bar");
    expect(args).toContain("Accept: application/json");
  });

  test("body string sent via --data-raw", () => {
    const args = build({ url: "https://e.com", method: "POST", body: "raw-payload" });
    expect(args).toContain("--data-raw");
    expect(args).toContain("raw-payload");
  });

  test("body object is JSON-serialized and Content-Type:application/json injected", () => {
    const args = build({ url: "https://e.com", method: "POST", body: { a: 1 } });
    expect(args).toContain("--data-raw");
    expect(args).toContain('{"a":1}');
    expect(args).toContain("Content-Type: application/json");
  });

  test("form sent via --data-urlencode (one per pair)", () => {
    const args = build({ url: "https://e.com", method: "POST", form: { a: "1", b: "hello world" } });
    const pairs = args.filter((a, i) => args[i - 1] === "--data-urlencode");
    expect(pairs).toContain("a=1");
    expect(pairs).toContain("b=hello world");
  });

  test("form and body are mutually exclusive (form wins, body ignored)", () => {
    const args = build({ url: "https://e.com", method: "POST", body: "X", form: { a: "1" } });
    expect(args).not.toContain("X");
    expect(args).toContain("--data-urlencode");
  });

  test("query params appended to URL", () => {
    const args = build({ url: "https://e.com/path", query: { q: "hello world", page: "2" } });
    const url = args[args.length - 1];
    expect(url).toMatch(/^https:\/\/e\.com\/path\?/);
    expect(url).toContain("q=hello+world");
    expect(url).toContain("page=2");
  });

  test("query merges with existing URL params", () => {
    const args = build({ url: "https://e.com/?a=1", query: { b: "2" } });
    const url = args[args.length - 1];
    expect(url).toContain("a=1");
    expect(url).toContain("b=2");
  });

  test("basic_auth via -u", () => {
    const args = build({ url: "https://e.com", basic_auth: { user: "alice", pass: "secret" } });
    expect(args).toContain("-u");
    expect(args).toContain("alice:secret");
  });

  test("cookies serialized into a Cookie header", () => {
    const args = build({ url: "https://e.com", cookies: { sid: "abc", theme: "dark" } });
    const idx = args.indexOf("Cookie: sid=abc; theme=dark");
    expect(idx).toBeGreaterThan(-1);
  });

  test("follow_redirects:false disables -L", () => {
    const args = build({ url: "https://e.com", follow_redirects: false });
    expect(args).not.toContain("-L");
  });

  test("ignore_ssl adds -k", () => {
    const args = build({ url: "https://e.com", ignore_ssl: true });
    expect(args).toContain("-k");
  });

  test("custom timeout and max_size override defaults", () => {
    const args = build({ url: "https://e.com", timeout_seconds: 60, max_size_kb: 1000 });
    expect(args).toContain("60");
    expect(args).toContain(String(1000 * 1024 * 2));
  });

  test("HEAD uses -I instead of -X HEAD (curl convention)", () => {
    const args = build({ url: "https://e.com", method: "HEAD" });
    expect(args).toContain("-I");
    expect(args).not.toContain("-X");
  });

  test("metadata trailer -w appended", () => {
    const args = build({ url: "https://e.com" });
    expect(args).toContain("-w");
    const wIdx = args.indexOf("-w");
    expect(args[wIdx + 1]).toContain("%{http_code}");
    expect(args[wIdx + 1]).toContain("%{url_effective}");
  });

  test("-D - -o - emits headers then body to stdout", () => {
    const args = build({ url: "https://e.com" });
    expect(args).toContain("-D");
    expect(args).toContain("-o");
  });

  test("--silent --show-error so stderr only has real errors", () => {
    const args = build({ url: "https://e.com" });
    expect(args).toContain("--silent");
    expect(args).toContain("--show-error");
  });
});
