import { describe, expect, test } from "bun:test";
import { isPrivateIp, isBlockedHostname, assertNotPrivate } from "../lib/ssrf-guard.ts";
import { InvalidUrlError, SsrfBlockedError } from "../types.ts";

describe("isPrivateIp", () => {
  test.each([
    ["127.0.0.1", true],
    ["127.255.255.255", true],
    ["10.0.0.1", true],
    ["10.255.255.255", true],
    ["172.16.0.1", true],
    ["172.31.255.255", true],
    ["172.15.0.1", false],
    ["172.32.0.1", false],
    ["192.168.1.1", true],
    ["192.168.255.255", true],
    ["169.254.169.254", true],
    ["0.0.0.0", true],
    ["::1", true],
    ["fe80::1", true],
    ["fc00::1", true],
    ["fd00::1", true],
    ["8.8.8.8", false],
    ["1.1.1.1", false],
    ["2606:4700:4700::1111", false],
  ])("isPrivateIp(%s) === %s", (ip, expected) => {
    expect(isPrivateIp(ip)).toBe(expected);
  });
});

describe("isBlockedHostname", () => {
  test("blocks built-in hosts", () => {
    expect(isBlockedHostname("localhost", [])).toBe(true);
    expect(isBlockedHostname("ip6-localhost", [])).toBe(true);
    expect(isBlockedHostname("metadata.google.internal", [])).toBe(true);
  });

  test("case-insensitive", () => {
    expect(isBlockedHostname("LOCALHOST", [])).toBe(true);
    expect(isBlockedHostname("MetaData.Google.Internal", [])).toBe(true);
  });

  test("blocks configured extras", () => {
    expect(isBlockedHostname("internal.corp.local", ["internal.corp.local"])).toBe(true);
  });

  test("allows public hosts", () => {
    expect(isBlockedHostname("example.com", [])).toBe(false);
    expect(isBlockedHostname("api.github.com", [])).toBe(false);
  });
});

describe("assertNotPrivate", () => {
  test("InvalidUrlError on non-http(s)", async () => {
    await expect(assertNotPrivate("ftp://example.com", false, [])).rejects.toBeInstanceOf(InvalidUrlError);
    await expect(assertNotPrivate("file:///etc/passwd", false, [])).rejects.toBeInstanceOf(InvalidUrlError);
  });

  test("InvalidUrlError on malformed URL", async () => {
    await expect(assertNotPrivate("not a url", false, [])).rejects.toBeInstanceOf(InvalidUrlError);
  });

  test("blocks private literal IP", async () => {
    await expect(assertNotPrivate("http://127.0.0.1/", false, [])).rejects.toBeInstanceOf(SsrfBlockedError);
    await expect(assertNotPrivate("http://10.0.0.1/x", false, [])).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  test("blocks blocklisted hostname", async () => {
    await expect(assertNotPrivate("http://localhost:8080/", false, [])).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  test("blocks DNS rebinding (public hostname resolves to private IP)", async () => {
    const lookup = async () => ({ address: "10.0.0.5", family: 4 as const });
    await expect(assertNotPrivate("http://evil.example.com/", false, [], lookup)).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  test("allow_private bypasses all checks", async () => {
    await expect(assertNotPrivate("http://127.0.0.1/", true, [])).resolves.toBeUndefined();
    await expect(assertNotPrivate("http://localhost/", true, [])).resolves.toBeUndefined();
  });

  test("public host with public DNS resolution passes", async () => {
    const lookup = async () => ({ address: "8.8.8.8", family: 4 as const });
    await expect(assertNotPrivate("http://example.com/", false, [], lookup)).resolves.toBeUndefined();
  });
});
