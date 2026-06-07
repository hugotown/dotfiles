import { describe, expect, test } from "bun:test";
import { checkBashCommand } from "../lib/bash-guard.ts";

const ENABLED = { enabled: true, block_commands: ["curl", "wget", "httpie", "xh", "aria2c", "nc", "ncat"] };
const DISABLED = { enabled: false, block_commands: ["curl"] };

describe("checkBashCommand", () => {
  test("blocks external curl with https", () => {
    expect(checkBashCommand("curl https://example.com", ENABLED)?.block).toBe(true);
  });

  test("blocks external wget with http", () => {
    expect(checkBashCommand("wget http://example.com -O out", ENABLED)?.block).toBe(true);
  });

  test("blocks command pipelines (curl mid-pipeline)", () => {
    expect(checkBashCommand("echo x | curl https://api.x.com -d @-", ENABLED)?.block).toBe(true);
  });

  test("allows curl localhost (private host)", () => {
    expect(checkBashCommand("curl http://localhost:8080", ENABLED)).toBeNull();
    expect(checkBashCommand("curl http://127.0.0.1:3000/api", ENABLED)).toBeNull();
  });

  test("allows curl RFC1918 (private LAN)", () => {
    expect(checkBashCommand("curl http://192.168.1.1", ENABLED)).toBeNull();
    expect(checkBashCommand("curl http://10.0.0.5/health", ENABLED)).toBeNull();
    expect(checkBashCommand("curl http://172.16.0.1", ENABLED)).toBeNull();
  });

  test("allows non-HTTP commands", () => {
    expect(checkBashCommand("echo hello", ENABLED)).toBeNull();
    expect(checkBashCommand("ls -la /tmp", ENABLED)).toBeNull();
    expect(checkBashCommand("git log", ENABLED)).toBeNull();
  });

  test("does NOT block when the URL is the only thing matching (no command)", () => {
    expect(checkBashCommand("echo https://example.com", ENABLED)).toBeNull();
  });

  test("blocks httpie / xh / aria2c / nc / ncat with external URL", () => {
    expect(checkBashCommand("httpie GET https://x.com", ENABLED)?.block).toBe(true);
    expect(checkBashCommand("xh https://x.com", ENABLED)?.block).toBe(true);
    expect(checkBashCommand("aria2c https://x.com/file.zip", ENABLED)?.block).toBe(true);
  });

  test("returns null when disabled, even for blocked commands", () => {
    expect(checkBashCommand("curl https://example.com", DISABLED)).toBeNull();
  });

  test("reason text mentions investigate and curl tool", () => {
    const r = checkBashCommand("curl https://example.com", ENABLED);
    expect(r?.reason).toContain("investigate");
    expect(r?.reason).toContain("curl");
  });
});
