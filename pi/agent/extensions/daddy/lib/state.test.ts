// lib/state.test.ts
import { test, expect } from "bun:test";
import { saveRun, loadRun, listRuns, saveStreams, loadStreams, runFile, findRun } from "./state.ts";
import type { RunState } from "../runtime-types.ts";
import type { StreamEntry } from "../panel/store.ts";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const home = fs.mkdtempSync(path.join(os.tmpdir(), "ht-state-"));
const state: RunState = {
  id: "r1", workflow: "w", arguments: "", status: "running",
  artifacts_dir: "/tmp", base_branch: "main", started_at: "t", nodes: {},
};

test("save then load round-trips", () => {
  saveRun(home, state);
  expect(loadRun(home, "r1")?.workflow).toBe("w");
});

test("loadRun returns null for missing", () => {
  expect(loadRun(home, "nope")).toBeNull();
});

test("listRuns returns saved runs", () => {
  expect(listRuns(home).map((r) => r.id)).toContain("r1");
});

test("saveStreams then loadStreams round-trips the journal", () => {
  const streamsHome = fs.mkdtempSync(path.join(os.tmpdir(), "ht-streams-"));
  const journal: Record<string, StreamEntry[]> = {
    interview: [
      { type: "text", content: "hello", timestamp: 1 },
      { type: "tool_call", content: "bash", timestamp: 2 },
    ],
    summary: [{ type: "text", content: "world", timestamp: 3 }],
  };
  saveStreams(streamsHome, "r2", journal);
  expect(loadStreams(streamsHome, "r2")).toEqual(journal);
});

test("loadStreams returns an empty object when no journal file exists", () => {
  const streamsHome = fs.mkdtempSync(path.join(os.tmpdir(), "ht-streams-"));
  expect(loadStreams(streamsHome, "nope")).toEqual({});
});

test("runFile returns the persisted run path", () => {
  expect(runFile("/home", "r1")).toBe(path.join("/home", "runs", "r1.json"));
});

test("findRun resolves exact id before prefix", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "daddy-state-"));
  saveRun(home, { id: "abc", workflow: "w", arguments: "", status: "completed", artifacts_dir: "/a", base_branch: "main", started_at: "t", nodes: {} });
  saveRun(home, { id: "abcd", workflow: "w", arguments: "", status: "completed", artifacts_dir: "/a", base_branch: "main", started_at: "t", nodes: {} });
  expect(findRun(home, "abc")?.id).toBe("abc");
});

test("findRun returns null for ambiguous prefix", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "daddy-state-"));
  saveRun(home, { id: "abc1", workflow: "w", arguments: "", status: "completed", artifacts_dir: "/a", base_branch: "main", started_at: "t", nodes: {} });
  saveRun(home, { id: "abc2", workflow: "w", arguments: "", status: "completed", artifacts_dir: "/a", base_branch: "main", started_at: "t", nodes: {} });
  expect(findRun(home, "abc")).toBeNull();
});
