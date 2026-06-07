import { describe, expect, test } from "bun:test";
import { parseCurlStdout, parseHeaderBlock } from "../lib/curl-parse.ts";

describe("parseHeaderBlock", () => {
  test("parses status line + headers", () => {
    const block = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: 42\r\n";
    const { status_code, status_text, headers } = parseHeaderBlock(block);
    expect(status_code).toBe(200);
    expect(status_text).toBe("OK");
    expect(headers["content-type"]).toBe("text/html");
    expect(headers["content-length"]).toBe("42");
  });

  test("lowercases header names", () => {
    const block = "HTTP/2 201 Created\r\nX-Custom-Thing: VALUE\r\n";
    const { headers } = parseHeaderBlock(block);
    expect(headers["x-custom-thing"]).toBe("VALUE");
  });

  test("status_text empty when missing (HTTP/2)", () => {
    const block = "HTTP/2 204 \r\n";
    expect(parseHeaderBlock(block).status_text).toBe("");
  });
});

describe("parseCurlStdout", () => {
  const META = "__CURL_META__200|https://example.com/final|1.234|678";

  test("splits headers / body / metadata trailer", () => {
    const stdout = Buffer.from([
      "HTTP/1.1 200 OK\r\n",
      "Content-Type: text/plain\r\n",
      "\r\n",
      "body line 1\nbody line 2\n",
      META,
      "\n",
    ].join(""));
    const r = parseCurlStdout(stdout);
    expect(r.status_code).toBe(200);
    expect(r.headers["content-type"]).toBe("text/plain");
    expect(r.body.toString("utf-8")).toBe("body line 1\nbody line 2\n");
    expect(r.final_url).toBe("https://example.com/final");
    expect(r.response_time_ms).toBe(1234);
    expect(r.size_bytes).toBe(678);
  });

  test("handles redirect chains: keeps LAST header block", () => {
    const stdout = Buffer.from([
      "HTTP/1.1 301 Moved\r\n",
      "Location: https://b\r\n",
      "\r\n",
      "HTTP/1.1 200 OK\r\n",
      "Content-Type: text/html\r\n",
      "\r\n",
      "<html/>",
      META,
      "\n",
    ].join(""));
    const r = parseCurlStdout(stdout);
    expect(r.status_code).toBe(200);
    expect(r.headers["content-type"]).toBe("text/html");
    expect(r.body.toString("utf-8")).toBe("<html/>");
    expect(r.redirected).toBe(true);
  });

  test("throws if metadata trailer missing", () => {
    const stdout = Buffer.from("HTTP/1.1 200 OK\r\n\r\nbody");
    expect(() => parseCurlStdout(stdout)).toThrow(/metadata trailer/i);
  });
});
