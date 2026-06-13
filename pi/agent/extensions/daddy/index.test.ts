// index.test.ts
import { test, expect } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import daddy from "./index.ts";

function fakePi() {
  const reg = { commands: [] as string[], tools: [] as string[], events: [] as string[] };
  const pi = {
    registerCommand: (name: string) => reg.commands.push(name),
    registerTool: (t: { name: string }) => reg.tools.push(t.name),
    on: (e: string) => reg.events.push(e),
    sendMessage: () => {}, appendEntry: () => {},
    exec: async () => ({ stdout: "", stderr: "", code: 0, killed: false }),
  };
  return { pi, reg };
}

test("registers command, tool, and session_start hook", () => {
  const { pi, reg } = fakePi();
  daddy(pi as never);
  expect(reg.commands).toContain("daddy");
  expect(reg.tools).toContain("daddy");
  expect(reg.events).toContain("session_start");
});

test("observer command opens a panel overlay", async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "daddy-idx-"));
  let customCalled = false;
  const pi = {
    registerCommand: (_n: string, opts: { handler: (a: string, c: unknown) => Promise<void> }) => { (pi as any)._handler = opts.handler; },
    registerTool: () => {},
    on: () => {},
    sendMessage: () => {}, appendEntry: () => {},
    exec: async () => ({ stdout: "", stderr: "", code: 0, killed: false }),
  };
  const ctx = {
    cwd,
    hasUI: true,
    ui: {
      notify: () => {}, setStatus: () => {}, setWorkingMessage: () => {},
      custom: () => { customCalled = true; return Promise.resolve(); },
    },
  };
  daddy(pi as never);
  await (pi as any)._handler("observer", ctx);
  expect(customCalled).toBe(true);
});
