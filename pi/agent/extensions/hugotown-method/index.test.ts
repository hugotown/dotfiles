// index.test.ts
import { test, expect } from "bun:test";
import hugotownMethod from "./index.ts";

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
  hugotownMethod(pi as never);
  expect(reg.commands).toContain("hugotown-method");
  expect(reg.tools).toContain("hugotown_method");
  expect(reg.events).toContain("session_start");
});
