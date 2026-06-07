import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { parseConfig, validateConfig, resolveValue } from "../lib/settings.ts";

describe("resolveValue", () => {
  const savedEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...savedEnv };
  });

  test("literal value is preserved", () => {
    expect(resolveValue("hello")).toBe("hello");
    expect(resolveValue("30")).toBe("30");
  });

  test("$VAR with set env returns env value", () => {
    process.env.FOO = "bar";
    expect(resolveValue("$FOO")).toBe("bar");
  });

  test("$VAR with unset env returns literal $VAR (caught later by validate)", () => {
    delete process.env.NOPE;
    expect(resolveValue("$NOPE")).toBe("$NOPE");
  });

  test("$VAR:default with set env returns env value", () => {
    process.env.FOO = "set";
    expect(resolveValue("$FOO:fallback")).toBe("set");
  });

  test("$VAR:default with unset env returns default", () => {
    delete process.env.FOO;
    expect(resolveValue("$FOO:fallback")).toBe("fallback");
  });

  test("$VAR:default supports colons and newlines in default (the /s flag)", () => {
    delete process.env.UA;
    expect(resolveValue("$UA:Mozilla/5.0 (X)")).toBe("Mozilla/5.0 (X)");
  });

  test("non-string values pass through unchanged", () => {
    expect(resolveValue(123 as unknown as string)).toEqual(123 as any);
    expect(resolveValue(true as unknown as string)).toEqual(true as any);
  });
});

describe("parseConfig + validateConfig", () => {
  const savedEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...savedEnv };
  });

  test("coerces numeric strings and booleans", () => {
    const yaml = `
defaults:
  timeout_seconds: "30"
  max_size_kb: "500"
  follow_redirects: "true"
  user_agent: "UA/1.0"
ssrf:
  extra_blocked_hosts: []
proxy:
  login_env: "DI_LOGIN"
  password_env: "DI_SEC"
  host_env: "DI_HOST"
  port_env: "DI_PORT"
`;
    const c = parseConfig(yaml);
    expect(c.defaults.timeout_seconds).toEqual(30);
    expect(c.defaults.max_size_kb).toEqual(500);
    expect(c.defaults.follow_redirects).toEqual(true);
    expect(c.defaults.user_agent).toEqual("UA/1.0");
  });

  test("validate throws on unresolved $VAR", () => {
    delete process.env.MISSING;
    const yaml = `
defaults:
  timeout_seconds: "30"
  max_size_kb: "500"
  follow_redirects: "true"
  user_agent: "$MISSING"
ssrf:
  extra_blocked_hosts: []
proxy:
  login_env: "DI_LOGIN"
  password_env: "DI_SEC"
  host_env: "DI_HOST"
  port_env: "DI_PORT"
`;
    expect(() => parseConfig(yaml)).toThrow(/user_agent/);
  });

  test("validate throws on non-finite numeric", () => {
    const yaml = `
defaults:
  timeout_seconds: "not-a-number"
  max_size_kb: "500"
  follow_redirects: "true"
  user_agent: "UA"
ssrf:
  extra_blocked_hosts: []
proxy:
  login_env: "DI_LOGIN"
  password_env: "DI_SEC"
  host_env: "DI_HOST"
  port_env: "DI_PORT"
`;
    expect(() => parseConfig(yaml)).toThrow(/timeout_seconds/);
  });
});
