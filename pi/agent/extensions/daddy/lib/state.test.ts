// lib/state.test.ts
import { test, expect } from "bun:test";
import { saveRun, loadRun, listRuns, saveStreams, loadStreams } from "./state.ts";
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
