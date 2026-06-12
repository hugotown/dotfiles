// lib/wt.test.ts
import { test, expect } from "bun:test";
import { wtCreate, wtPath, wtRemove, wtMerge } from "./wt.ts";
import type { ExecLike } from "../runtime-types.ts";

const fakeExec = (responses: Record<string, { stdout?: string; code?: number }>): ExecLike =>
  async (cmd, args) => {
    const key = `${cmd} ${args.join(" ")}`;
    const r = responses[key] ?? { code: 0 };
    return { stdout: r.stdout ?? "", stderr: "", code: r.code ?? 0, killed: false };
  };

test("wtCreate switches then resolves path", async () => {
  const exec = fakeExec({
    "wt switch --create hugotown/x": { code: 0 },
    "wt list --format=json": { stdout: JSON.stringify([{ branch: "hugotown/x", path: "/wt/x" }]) },
  });
  expect((await wtCreate(exec, "hugotown/x", "/repo")).path).toBe("/wt/x");
});

test("wtPath returns null when branch absent", async () => {
  const exec = fakeExec({ "wt list --format=json": { stdout: "[]" } });
  expect(await wtPath(exec, "missing", "/repo")).toBeNull();
});

test("wtRemove issues remove with flags", async () => {
  let called = "";
  const exec: ExecLike = async (cmd, args) => { called = `${cmd} ${args.join(" ")}`; return { stdout: "", stderr: "", code: 0, killed: false }; };
  await wtRemove(exec, "hugotown/x", "/repo");
  expect(called).toBe("wt remove hugotown/x --yes --force");
});

test("wtMerge issues merge with --yes", async () => {
  let called = "";
  const exec: ExecLike = async (cmd, args) => { called = `${cmd} ${args.join(" ")}`; return { stdout: "", stderr: "", code: 0, killed: false }; };
  await wtMerge(exec, "/repo");
  expect(called).toBe("wt merge --yes");
});

test("wtMerge throws on non-zero exit", async () => {
  const exec: ExecLike = async () => ({ stdout: "", stderr: "boom", code: 1, killed: false });
  await expect(wtMerge(exec, "/repo")).rejects.toThrow(/boom/);
});
