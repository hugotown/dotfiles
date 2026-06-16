# Daddy Reliability Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `daddy` workflows diagnosable, recoverable, auditable, and safer to run without turning `daddy` into a clone of `pi-subagents`.

**Architecture:** Add small runtime modules around the existing persisted `RunState`: diagnostics, deep status formatting, lifecycle control, acceptance provenance, and preflight summaries. Keep workflow execution in `lib/dag-executor.ts`; add validation/control helpers beside existing `lib/*` modules and route them through `/daddy` commands.

**Tech Stack:** TypeScript, Bun test, Node `fs/path`, existing Pi extension APIs, existing YAML workflow loader, existing TUI panel.

---

## Source Spec

Read first: `docs/superpowers/specs/2026-06-16-daddy-reliability-layer-design.md`.

## File Structure

- Modify: `agent/extensions/daddy/lib/command-router.ts` — parse new `/daddy` subcommands and optional ids.
- Modify: `agent/extensions/daddy/lib/handle-command.ts` — route new commands to small helper modules.
- Modify: `agent/extensions/daddy/lib/state.ts` — add run file path helpers, exact/prefix lookup, and save utilities needed by control commands.
- Modify: `agent/extensions/daddy/lib/summary.ts` — keep short summary but include acceptance when present.
- Create: `agent/extensions/daddy/lib/status-report.ts` — detailed `status [id]` formatter.
- Create: `agent/extensions/daddy/lib/doctor.ts` — read-only environment/workflow/run diagnostics.
- Create: `agent/extensions/daddy/lib/run-control.ts` — cancel, recover, retry-node state mutation helpers.
- Modify: `agent/extensions/daddy/runtime-types.ts` — add optional run/node metadata for control and acceptance provenance.
- Modify: `agent/extensions/daddy/types.ts` — add `acceptance` schema types to workflow and node definitions.
- Modify: `agent/extensions/daddy/lib/validator.ts` — validate acceptance shapes and preflight-relevant config.
- Create: `agent/extensions/daddy/lib/acceptance.ts` — resolve acceptance config, parse acceptance reports, run verification commands, and store provenance.
- Modify: `agent/extensions/daddy/lib/dag-executor.ts` — invoke acceptance checks after node execution.
- Create: `agent/extensions/daddy/lib/preflight.ts` — read-only workflow risk summary.
- Modify: `agent/extensions/daddy/panel/component.ts` — show available contextual actions in the header/footer once status/control exists.
- Modify: `agent/extensions/daddy/README.md` — document new commands, acceptance, preflight, and corrected panel status.

Each task below is independently testable. Do not commit unless the user explicitly asks for commits in the implementation session.

---

### Task 1: Parse New Commands

**Files:**
- Modify: `agent/extensions/daddy/lib/command-router.ts`
- Modify: `agent/extensions/daddy/lib/command-router.test.ts`

- [ ] **Step 1: Write failing parser tests**

Add these cases to `agent/extensions/daddy/lib/command-router.test.ts`:

```ts
test("parses status with optional id", () => {
  expect(parseCommand("status")).toEqual({ kind: "status", id: "" });
  expect(parseCommand("status abc123")).toEqual({ kind: "status", id: "abc123" });
});

test("parses doctor", () => {
  expect(parseCommand("doctor")).toEqual({ kind: "doctor" });
});

test("parses cancel with id and reason", () => {
  expect(parseCommand("cancel r1 because stuck")).toEqual({ kind: "cancel", id: "r1", reason: "because stuck" });
});

test("parses recover", () => {
  expect(parseCommand("recover r1")).toEqual({ kind: "recover", id: "r1" });
});

test("parses retry node", () => {
  expect(parseCommand("retry r1 test-node")).toEqual({ kind: "retry", id: "r1", node: "test-node" });
});

test("parses cleanup", () => {
  expect(parseCommand("cleanup")).toEqual({ kind: "cleanup" });
});

test("parses preflight", () => {
  expect(parseCommand("preflight fix-issue #42")).toEqual({ kind: "preflight", flow: "fix-issue", args: "#42" });
});
```

- [ ] **Step 2: Run parser tests and verify failure**

Run: `bun test agent/extensions/daddy/lib/command-router.test.ts`

Expected: failures because the new command variants are not in `ParsedCommand` yet.

- [ ] **Step 3: Extend `ParsedCommand` and parser**

Update `agent/extensions/daddy/lib/command-router.ts` to this shape:

```ts
// lib/command-router.ts — Parse the raw /daddy argument string into a command.
export type ParsedCommand =
  | { kind: "run"; flow: string; args: string }
  | { kind: "list" } | { kind: "status"; id: string } | { kind: "observer" } | { kind: "doctor" }
  | { kind: "resume"; id: string }
  | { kind: "approve"; comment: string } | { kind: "reject"; reason: string }
  | { kind: "cancel"; id: string; reason: string }
  | { kind: "recover"; id: string }
  | { kind: "retry"; id: string; node: string }
  | { kind: "cleanup" }
  | { kind: "preflight"; flow: string; args: string }
  | { kind: "merge" } | { kind: "remove" } | { kind: "keep" }
  | { kind: "validate"; name: string }
  | { kind: "unknown"; raw: string };

export function parseCommand(args: string): ParsedCommand {
  const trimmed = args.trim();
  const flow = trimmed.match(/^flow=(\S+)\s*([\s\S]*)$/);
  if (flow) return { kind: "run", flow: flow[1], args: flow[2].trim() };
  const [word = "", ...rest] = trimmed.split(/\s+/);
  const tail = trimmed.slice(word.length).trim();
  switch (word) {
    case "list": return { kind: "list" };
    case "status": return { kind: "status", id: rest[0] ?? "" };
    case "observer": return { kind: "observer" };
    case "doctor": return { kind: "doctor" };
    case "resume": return { kind: "resume", id: rest[0] ?? "" };
    case "approve": return { kind: "approve", comment: tail };
    case "reject": return { kind: "reject", reason: tail };
    case "cancel": return { kind: "cancel", id: rest[0] ?? "", reason: rest.slice(1).join(" ") };
    case "recover": return { kind: "recover", id: rest[0] ?? "" };
    case "retry": return { kind: "retry", id: rest[0] ?? "", node: rest[1] ?? "" };
    case "cleanup": return { kind: "cleanup" };
    case "preflight": return { kind: "preflight", flow: rest[0] ?? "", args: rest.slice(1).join(" ") };
    case "merge": return { kind: "merge" };
    case "remove": return { kind: "remove" };
    case "keep": return { kind: "keep" };
    case "validate": return { kind: "validate", name: rest[0] ?? "" };
    default: return { kind: "unknown", raw: trimmed };
  }
}
```

- [ ] **Step 4: Run parser tests and verify pass**

Run: `bun test agent/extensions/daddy/lib/command-router.test.ts`

Expected: all parser tests pass.

---

### Task 2: Add State Lookup Helpers

**Files:**
- Modify: `agent/extensions/daddy/lib/state.ts`
- Modify: `agent/extensions/daddy/lib/state.test.ts`

- [ ] **Step 1: Write failing state tests**

Add to `agent/extensions/daddy/lib/state.test.ts`:

```ts
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
```

If `path`, `os`, or `fs` are not already imported, add:

```ts
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
```

- [ ] **Step 2: Run state tests and verify failure**

Run: `bun test agent/extensions/daddy/lib/state.test.ts`

Expected: failures because `runFile` and `findRun` do not exist.

- [ ] **Step 3: Add state helpers**

Add these exports to `agent/extensions/daddy/lib/state.ts`:

```ts
export function runFile(home: string, id: string): string {
  return path.join(runsDir(home), `${id}.json`);
}

export function findRun(home: string, idOrPrefix: string): RunState | null {
  if (!idOrPrefix) return null;
  const exact = loadRun(home, idOrPrefix);
  if (exact) return exact;
  const matches = listRuns(home).filter((r) => r.id.startsWith(idOrPrefix));
  return matches.length === 1 ? matches[0] : null;
}
```

Change existing `saveRun` and `loadRun` to use `runFile(home, id)`.

- [ ] **Step 4: Run state tests and verify pass**

Run: `bun test agent/extensions/daddy/lib/state.test.ts`

Expected: all state tests pass.

---

### Task 3: Add Deep Status Report

**Files:**
- Create: `agent/extensions/daddy/lib/status-report.ts`
- Create: `agent/extensions/daddy/lib/status-report.test.ts`
- Modify: `agent/extensions/daddy/lib/handle-command.ts`

- [ ] **Step 1: Write failing status report tests**

Create `agent/extensions/daddy/lib/status-report.test.ts`:

```ts
import { expect, test } from "bun:test";
import { buildStatusReport } from "./status-report.ts";
import type { RunState } from "../runtime-types.ts";

const run: RunState = {
  id: "r1",
  workflow: "fix-issue",
  arguments: "#42",
  status: "paused",
  paused_node: "gate",
  artifacts_dir: "/repo/.daddy/artifacts/r1",
  base_branch: "main",
  started_at: "2026-06-16T00:00:00.000Z",
  worktree: { branch: "daddy/fix-issue-r1", path: "/tmp/wt" },
  nodes: {
    plan: { status: "completed", output: "Plan", attempts: 1, model: "claude", started_at: "2026-06-16T00:00:00.000Z", completed_at: "2026-06-16T00:01:00.000Z" },
    gate: { status: "paused", output: "Approve?" },
  },
};

test("buildStatusReport includes run metadata and actions", () => {
  const text = buildStatusReport(run, "/repo/.daddy/runs/r1.json");
  expect(text).toContain("Run r1 — paused");
  expect(text).toContain("workflow: fix-issue");
  expect(text).toContain("paused node: gate");
  expect(text).toContain("worktree: daddy/fix-issue-r1 at /tmp/wt");
  expect(text).toContain("artifacts: /repo/.daddy/artifacts/r1");
  expect(text).toContain("plan completed");
  expect(text).toContain("gate paused");
  expect(text).toContain("next actions: /daddy approve");
});
```

- [ ] **Step 2: Run test and verify failure**

Run: `bun test agent/extensions/daddy/lib/status-report.test.ts`

Expected: module not found.

- [ ] **Step 3: Implement status report formatter**

Create `agent/extensions/daddy/lib/status-report.ts`:

```ts
import type { NodeState, RunState } from "../runtime-types.ts";

function duration(start?: string, end?: string): string {
  if (!start || !end) return "";
  const ms = Date.parse(end) - Date.parse(start);
  if (!Number.isFinite(ms) || ms < 0) return "";
  return ` (${Math.round(ms / 1000)}s)`;
}

function nodeLine(id: string, node: NodeState): string {
  const bits = [id, node.status];
  if (node.attempts) bits.push(`attempts=${node.attempts}`);
  if (node.model) bits.push(`model=${node.model}`);
  const time = duration(node.started_at, node.completed_at);
  const err = node.error ? ` — ${node.error}` : "";
  return `- ${bits.join(" ")}${time}${err}`;
}

function nextActions(state: RunState): string {
  if (state.status === "paused") return "/daddy approve, /daddy reject, /daddy cancel";
  if (state.status === "failed") return "/daddy recover, /daddy retry <id> <node>, /daddy cancel";
  if (state.status === "running") return "/daddy cancel, /daddy status <id>";
  if (state.worktree && state.status === "completed") return "/daddy merge, /daddy remove, /daddy keep";
  return "none";
}

export function buildStatusReport(state: RunState, filePath?: string): string {
  const lines = [
    `Run ${state.id} — ${state.status}`,
    `workflow: ${state.workflow}`,
    `arguments: ${state.arguments || "(none)"}`,
    `base branch: ${state.base_branch}`,
    `started: ${state.started_at}`,
  ];
  if (state.completed_at) lines.push(`completed: ${state.completed_at}`);
  if (state.paused_node) lines.push(`paused node: ${state.paused_node}`);
  if (state.worktree) lines.push(`worktree: ${state.worktree.branch} at ${state.worktree.path}`);
  lines.push(`artifacts: ${state.artifacts_dir}`);
  if (filePath) lines.push(`run file: ${filePath}`);
  lines.push("", "Nodes");
  for (const [id, node] of Object.entries(state.nodes)) lines.push(nodeLine(id, node));
  lines.push("", `next actions: ${nextActions(state)}`);
  return lines.join("\n");
}
```

- [ ] **Step 4: Wire `status [id]` in command handler**

In `agent/extensions/daddy/lib/handle-command.ts`, import:

```ts
import { findRun, listRuns, runFile } from "./state.ts";
import { buildStatusReport } from "./status-report.ts";
```

Replace the `status` case with:

```ts
case "status": {
  if (!p.id) return report(listRuns(deps.home).map((r) => `${r.id} ${r.workflow} ${r.status}`).join("\n") || "No runs.");
  const run = findRun(deps.home, p.id);
  if (!run) return report(`Run not found or ambiguous: ${p.id}`);
  return report(buildStatusReport(run, runFile(deps.home, run.id)));
}
```

- [ ] **Step 5: Update handler tests**

Add a handler test in `agent/extensions/daddy/lib/handle-command.test.ts` that saves a run and asserts `status <id>` includes `Run <id>`. Use `saveRun(home, state)` from `./state.ts`.

- [ ] **Step 6: Run affected tests**

Run: `bun test agent/extensions/daddy/lib/status-report.test.ts agent/extensions/daddy/lib/handle-command.test.ts`

Expected: all pass.

---

### Task 4: Add `/daddy doctor`

**Files:**
- Create: `agent/extensions/daddy/lib/doctor.ts`
- Create: `agent/extensions/daddy/lib/doctor.test.ts`
- Modify: `agent/extensions/daddy/lib/handle-command.ts`

- [ ] **Step 1: Write failing doctor tests**

Create `agent/extensions/daddy/lib/doctor.test.ts`:

```ts
import { expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { buildDoctorReport } from "./doctor.ts";
import { saveRun } from "./state.ts";

test("doctor reports directories, workflows, commands, and stale running runs", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "daddy-doctor-"));
  const home = path.join(root, ".daddy");
  const bundled = path.join(root, "bundled");
  fs.mkdirSync(path.join(home, "workflows"), { recursive: true });
  fs.mkdirSync(path.join(home, "commands"), { recursive: true });
  fs.mkdirSync(path.join(bundled, "workflows"), { recursive: true });
  fs.writeFileSync(path.join(home, "workflows", "ok.yaml"), "name: ok\ndescription: ok\nnodes:\n  - id: a\n    bash: echo hi\n");
  saveRun(home, { id: "r1", workflow: "ok", arguments: "", status: "running", artifacts_dir: path.join(home, "artifacts", "r1"), base_branch: "main", started_at: "2020-01-01T00:00:00.000Z", nodes: {} });
  const report = await buildDoctorReport({ home, projectDir: root, bundledDir: bundled, exec: async () => ({ stdout: "", stderr: "", code: 0, killed: false }) });
  expect(report).toContain("Daddy doctor report");
  expect(report).toContain("workflows: 1 valid, 0 invalid");
  expect(report).toContain("stale running runs: r1");
});
```

- [ ] **Step 2: Run test and verify failure**

Run: `bun test agent/extensions/daddy/lib/doctor.test.ts`

Expected: module not found.

- [ ] **Step 3: Implement doctor**

Create `agent/extensions/daddy/lib/doctor.ts`:

```ts
import * as fs from "node:fs";
import * as path from "node:path";
import { loadDef } from "./run-controller.ts";
import { listWorkflows } from "./discovery.ts";
import { listRuns } from "./state.ts";
import type { ExecLike } from "../runtime-types.ts";

interface DoctorInput {
  home: string;
  projectDir: string;
  bundledDir: string;
  exec: ExecLike;
}

function dirLine(label: string, dir: string): string {
  try {
    const stat = fs.statSync(dir);
    return `- ${label}: ${stat.isDirectory() ? "ok" : "not a directory"} (${dir})`;
  } catch {
    return `- ${label}: missing (${dir})`;
  }
}

async function commandLine(exec: ExecLike, command: string): Promise<string> {
  const result = await exec(command, ["--version"]);
  return `- ${command}: ${result.code === 0 ? "ok" : "unavailable"}`;
}

export async function buildDoctorReport(input: DoctorInput): Promise<string> {
  const dirs = [path.join(input.projectDir, ".daddy"), input.bundledDir];
  const workflows = listWorkflows(dirs);
  let valid = 0;
  const invalid: string[] = [];
  for (const wf of workflows) {
    try { loadDef(wf.name, { exec: input.exec, notify: () => {}, emit: () => {}, home: input.home, bundledDir: input.bundledDir, projectDir: input.projectDir }); valid++; }
    catch (e) { invalid.push(`${wf.name}: ${e instanceof Error ? e.message : String(e)}`); }
  }
  const runs = listRuns(input.home);
  const stale = runs.filter((r) => r.status === "running" && Date.parse(r.started_at) < Date.now() - 60 * 60 * 1000).map((r) => r.id);
  const lines = [
    "Daddy doctor report",
    "",
    "Filesystem",
    dirLine("home", input.home),
    dirLine("runs", path.join(input.home, "runs")),
    dirLine("artifacts", path.join(input.home, "artifacts")),
    dirLine("project workflows", path.join(input.projectDir, ".daddy", "workflows")),
    dirLine("project commands", path.join(input.projectDir, ".daddy", "commands")),
    "",
    "Workflows",
    `- workflows: ${valid} valid, ${invalid.length} invalid`,
    ...invalid.map((x) => `- invalid: ${x}`),
    "",
    "Runs",
    `- total runs: ${runs.length}`,
    `- stale running runs: ${stale.length ? stale.join(", ") : "none"}`,
    "",
    "Commands",
    await commandLine(input.exec, "pi"),
    await commandLine(input.exec, "wt"),
    await commandLine(input.exec, "gh"),
    await commandLine(input.exec, "bun"),
    await commandLine(input.exec, "uv"),
  ];
  return lines.join("\n");
}
```

- [ ] **Step 4: Wire doctor command**

In `agent/extensions/daddy/lib/handle-command.ts`, import:

```ts
import { buildDoctorReport } from "./doctor.ts";
```

Add switch case:

```ts
case "doctor": return report(await buildDoctorReport({ home: deps.home, projectDir: deps.projectDir, bundledDir: deps.bundledDir, exec: deps.exec }));
```

- [ ] **Step 5: Run doctor and handler tests**

Run: `bun test agent/extensions/daddy/lib/doctor.test.ts agent/extensions/daddy/lib/handle-command.test.ts`

Expected: all pass.

---

### Task 5: Add Cancel And Recover

**Files:**
- Create: `agent/extensions/daddy/lib/run-control.ts`
- Create: `agent/extensions/daddy/lib/run-control.test.ts`
- Modify: `agent/extensions/daddy/lib/handle-command.ts`

- [ ] **Step 1: Write failing run-control tests**

Create `agent/extensions/daddy/lib/run-control.test.ts`:

```ts
import { expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { cancelRun, recoverRun } from "./run-control.ts";
import { loadRun, saveRun } from "./state.ts";

function home(): string { return fs.mkdtempSync(path.join(os.tmpdir(), "daddy-control-")); }

test("cancelRun marks a run cancelled and preserves node outputs", () => {
  const h = home();
  saveRun(h, { id: "r1", workflow: "w", arguments: "", status: "running", artifacts_dir: "/a", base_branch: "main", started_at: "t", nodes: { a: { status: "running", output: "partial" } } });
  const text = cancelRun(h, "r1", "not needed");
  expect(text).toContain("Run r1 cancelled");
  const run = loadRun(h, "r1");
  expect(run?.status).toBe("cancelled");
  expect(run?.nodes.a.output).toBe("partial");
  expect(run?.nodes.a.status).toBe("cancelled");
});

test("recoverRun marks old running run as failed", () => {
  const h = home();
  saveRun(h, { id: "r1", workflow: "w", arguments: "", status: "running", artifacts_dir: "/a", base_branch: "main", started_at: "2020-01-01T00:00:00.000Z", nodes: { a: { status: "running", output: "" } } });
  const text = recoverRun(h, "r1");
  expect(text).toContain("recovered as failed");
  const run = loadRun(h, "r1");
  expect(run?.status).toBe("failed");
  expect(run?.nodes.a.status).toBe("failed");
});
```

- [ ] **Step 2: Run test and verify failure**

Run: `bun test agent/extensions/daddy/lib/run-control.test.ts`

Expected: module not found.

- [ ] **Step 3: Implement run control helpers**

Create `agent/extensions/daddy/lib/run-control.ts`:

```ts
import { findRun, saveRun } from "./state.ts";

const nowIso = () => new Date().toISOString();

export function cancelRun(home: string, id: string, reason: string): string {
  const run = findRun(home, id);
  if (!run) return `Run not found or ambiguous: ${id}`;
  run.status = "cancelled";
  run.completed_at = nowIso();
  for (const node of Object.values(run.nodes)) {
    if (node.status === "running" || node.status === "pending") {
      node.status = "cancelled";
      node.error = reason || "cancelled";
      node.completed_at = nowIso();
    }
  }
  saveRun(home, run);
  return `Run ${run.id} cancelled${reason ? `: ${reason}` : "."}`;
}

export function recoverRun(home: string, id: string): string {
  const run = findRun(home, id);
  if (!run) return `Run not found or ambiguous: ${id}`;
  if (run.status !== "running") return `Run ${run.id} does not need recovery; status is ${run.status}.`;
  run.status = "failed";
  run.completed_at = nowIso();
  for (const node of Object.values(run.nodes)) {
    if (node.status === "running") {
      node.status = "failed";
      node.error = "Recovered stale running node as failed.";
      node.completed_at = nowIso();
    }
  }
  saveRun(home, run);
  return `Run ${run.id} recovered as failed.`;
}
```

- [ ] **Step 4: Wire cancel and recover commands**

In `agent/extensions/daddy/lib/handle-command.ts`, import:

```ts
import { cancelRun, recoverRun } from "./run-control.ts";
```

Add cases:

```ts
case "cancel": return report(cancelRun(deps.home, p.id, p.reason));
case "recover": return report(recoverRun(deps.home, p.id));
```

- [ ] **Step 5: Run tests**

Run: `bun test agent/extensions/daddy/lib/run-control.test.ts agent/extensions/daddy/lib/handle-command.test.ts`

Expected: all pass.

---

### Task 6: Add Retry Node State Reset

**Files:**
- Modify: `agent/extensions/daddy/lib/run-control.ts`
- Modify: `agent/extensions/daddy/lib/run-control.test.ts`
- Modify: `agent/extensions/daddy/lib/handle-command.ts`

- [ ] **Step 1: Write failing retry tests**

Add to `agent/extensions/daddy/lib/run-control.test.ts`:

```ts
test("resetNodeForRetry removes selected node and downstream node state", () => {
  const h = home();
  saveRun(h, {
    id: "r1", workflow: "w", arguments: "", status: "failed", artifacts_dir: "/a", base_branch: "main", started_at: "t",
    nodes: {
      a: { status: "completed", output: "a" },
      b: { status: "failed", output: "", error: "boom" },
      c: { status: "skipped", output: "" },
    },
  });
  const text = resetNodeForRetry(h, "r1", "b", [{ id: "a", bash: "echo a" }, { id: "b", bash: "echo b", depends_on: ["a"] }, { id: "c", bash: "echo c", depends_on: ["b"] }]);
  expect(text).toContain("Reset b, c");
  const run = loadRun(h, "r1");
  expect(run?.status).toBe("running");
  expect(run?.nodes.a.status).toBe("completed");
  expect(run?.nodes.b).toBeUndefined();
  expect(run?.nodes.c).toBeUndefined();
});
```

Import `resetNodeForRetry` and `NodeDef` as needed.

- [ ] **Step 2: Run test and verify failure**

Run: `bun test agent/extensions/daddy/lib/run-control.test.ts`

Expected: missing `resetNodeForRetry`.

- [ ] **Step 3: Implement retry reset helper**

Add to `agent/extensions/daddy/lib/run-control.ts`:

```ts
import type { NodeDef } from "../types.ts";

function downstreamOf(nodes: NodeDef[], start: string): Set<string> {
  const result = new Set<string>([start]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (!result.has(node.id) && (node.depends_on ?? []).some((dep) => result.has(dep))) {
        result.add(node.id);
        changed = true;
      }
    }
  }
  return result;
}

export function resetNodeForRetry(home: string, id: string, nodeId: string, nodes: NodeDef[]): string {
  const run = findRun(home, id);
  if (!run) return `Run not found or ambiguous: ${id}`;
  if (!nodes.some((node) => node.id === nodeId)) return `Node not found in workflow: ${nodeId}`;
  const reset = downstreamOf(nodes, nodeId);
  for (const key of reset) delete run.nodes[key];
  run.status = "running";
  run.completed_at = undefined;
  run.paused_node = undefined;
  saveRun(home, run);
  return `Reset ${Array.from(reset).join(", ")} for retry in run ${run.id}. Use /daddy resume ${run.id}.`;
}
```

- [ ] **Step 4: Wire retry command without executing automatically**

In `agent/extensions/daddy/lib/handle-command.ts`, use `loadDef` and add:

```ts
case "retry": {
  const run = findRun(deps.home, p.id);
  if (!run) return report(`Run not found or ambiguous: ${p.id}`);
  const def = loadDef(run.workflow, deps);
  return report(resetNodeForRetry(deps.home, run.id, p.node, def.nodes));
}
```

This first version resets state and tells the user to resume. It avoids accidentally re-running side effects in the same command.

- [ ] **Step 5: Run tests**

Run: `bun test agent/extensions/daddy/lib/run-control.test.ts agent/extensions/daddy/lib/handle-command.test.ts`

Expected: all pass.

---

### Task 7: Add Acceptance Types And Validation

**Files:**
- Modify: `agent/extensions/daddy/types.ts`
- Modify: `agent/extensions/daddy/runtime-types.ts`
- Modify: `agent/extensions/daddy/lib/validator.ts`
- Modify: `agent/extensions/daddy/lib/validator.test.ts`

- [ ] **Step 1: Write failing validator tests**

Add to `agent/extensions/daddy/lib/validator.test.ts`:

```ts
test("accepts valid acceptance config", () => {
  expect(validateWorkflow({
    name: "w", description: "w",
    acceptance: { level: "verified", verify: [{ id: "unit", command: "bun test", timeout_ms: 1000 }] },
    nodes: [{ id: "a", bash: "echo hi" }],
  })).toBeNull();
});

test("rejects invalid acceptance level", () => {
  expect(validateWorkflow({
    name: "w", description: "w",
    acceptance: { level: "magic" },
    nodes: [{ id: "a", bash: "echo hi" }],
  } as never)).toContain("Invalid acceptance level");
});

test("rejects verify entries without command", () => {
  expect(validateWorkflow({
    name: "w", description: "w",
    nodes: [{ id: "a", bash: "echo hi", acceptance: { level: "verified", verify: [{ id: "unit" }] } }],
  } as never)).toContain("Acceptance verify entry");
});
```

- [ ] **Step 2: Run validator tests and verify failure**

Run: `bun test agent/extensions/daddy/lib/validator.test.ts`

Expected: validation does not know acceptance yet.

- [ ] **Step 3: Add acceptance types**

In `agent/extensions/daddy/types.ts`, add:

```ts
export type AcceptanceLevel = "none" | "attested" | "checked" | "verified" | "reviewed";

export interface AcceptanceVerifyCommand {
  id: string;
  command: string;
  timeout_ms?: number;
}

export interface AcceptanceConfig {
  level: AcceptanceLevel;
  reason?: string;
  criteria?: string[];
  evidence?: string[];
  verify?: AcceptanceVerifyCommand[];
}
```

Add `acceptance?: AcceptanceConfig;` to both `NodeDef` and `WorkflowDef`.

In `agent/extensions/daddy/runtime-types.ts`, add:

```ts
export type AcceptanceProvenance = "claimed" | "attested" | "checked" | "verified" | "reviewed" | "rejected";

export interface AcceptanceState {
  level: string;
  provenance: AcceptanceProvenance;
  summary: string;
}
```

Add `acceptance?: AcceptanceState;` to `NodeState` and `NodeResult`.

- [ ] **Step 4: Validate acceptance shape**

In `agent/extensions/daddy/lib/validator.ts`, add helper:

```ts
const ACCEPTANCE_LEVELS = new Set(["none", "attested", "checked", "verified", "reviewed"]);

function validateAcceptance(owner: string, acceptance: unknown): string | null {
  if (!acceptance) return null;
  if (typeof acceptance !== "object") return `Acceptance for ${owner} must be an object`;
  const a = acceptance as { level?: unknown; verify?: unknown };
  if (typeof a.level !== "string" || !ACCEPTANCE_LEVELS.has(a.level)) return `Invalid acceptance level for ${owner}`;
  if (a.verify !== undefined) {
    if (!Array.isArray(a.verify)) return `Acceptance verify for ${owner} must be a list`;
    for (const item of a.verify) {
      const v = item as { id?: unknown; command?: unknown };
      if (!v || typeof v.id !== "string" || typeof v.command !== "string") return `Acceptance verify entry for ${owner} must include id and command`;
    }
  }
  return null;
}
```

Call it for workflow-level config and each node.

- [ ] **Step 5: Run validator tests**

Run: `bun test agent/extensions/daddy/lib/validator.test.ts`

Expected: all pass.

---

### Task 8: Implement Acceptance Runtime Checks

**Files:**
- Create: `agent/extensions/daddy/lib/acceptance.ts`
- Create: `agent/extensions/daddy/lib/acceptance.test.ts`
- Modify: `agent/extensions/daddy/lib/dag-executor.ts`
- Modify: `agent/extensions/daddy/lib/summary.ts`

- [ ] **Step 1: Write failing acceptance tests**

Create `agent/extensions/daddy/lib/acceptance.test.ts`:

```ts
import { expect, test } from "bun:test";
import { applyAcceptance } from "./acceptance.ts";
import type { NodeResult, RunDeps } from "../runtime-types.ts";
import type { NodeDef, WorkflowDef } from "../types.ts";

const deps: RunDeps = {
  exec: async (_cmd, args) => ({ stdout: "", stderr: "", code: args.includes("fail") ? 1 : 0, killed: false }),
  notify: () => {}, emit: () => {}, home: "/h", bundledDir: "/b", projectDir: "/p",
};

test("applyAcceptance marks no config as claimed for completed AI output", async () => {
  const def = { name: "w", description: "w", nodes: [] } as WorkflowDef;
  const node = { id: "a", prompt: "work" } as NodeDef;
  const result: NodeResult = { status: "completed", output: "done" };
  expect((await applyAcceptance(def, node, result, deps)).acceptance?.provenance).toBe("claimed");
});

test("applyAcceptance runs verify commands", async () => {
  const def = { name: "w", description: "w", nodes: [] } as WorkflowDef;
  const node = { id: "a", bash: "echo", acceptance: { level: "verified", verify: [{ id: "unit", command: "pass" }] } } as NodeDef;
  const result: NodeResult = { status: "completed", output: "done" };
  expect((await applyAcceptance(def, node, result, deps)).acceptance?.provenance).toBe("verified");
});

test("applyAcceptance rejects failed verify commands", async () => {
  const def = { name: "w", description: "w", nodes: [] } as WorkflowDef;
  const node = { id: "a", bash: "echo", acceptance: { level: "verified", verify: [{ id: "unit", command: "fail" }] } } as NodeDef;
  const result: NodeResult = { status: "completed", output: "done" };
  const checked = await applyAcceptance(def, node, result, deps);
  expect(checked.status).toBe("failed");
  expect(checked.acceptance?.provenance).toBe("rejected");
});
```

- [ ] **Step 2: Run test and verify failure**

Run: `bun test agent/extensions/daddy/lib/acceptance.test.ts`

Expected: module not found.

- [ ] **Step 3: Implement acceptance helper**

Create `agent/extensions/daddy/lib/acceptance.ts`:

```ts
import type { RunDeps, NodeResult } from "../runtime-types.ts";
import type { AcceptanceConfig, NodeDef, WorkflowDef } from "../types.ts";

const AI_NODE_KEYS = new Set(["prompt", "command", "loop", "interview"]);

function isAiNode(node: NodeDef): boolean {
  return Object.keys(node).some((key) => AI_NODE_KEYS.has(key));
}

function resolveAcceptance(def: WorkflowDef, node: NodeDef): AcceptanceConfig | undefined {
  return node.acceptance ?? def.acceptance;
}

export async function applyAcceptance(def: WorkflowDef, node: NodeDef, result: NodeResult, deps: RunDeps): Promise<NodeResult> {
  if (result.status !== "completed") return result;
  const acceptance = resolveAcceptance(def, node);
  if (!acceptance) {
    return isAiNode(node) ? { ...result, acceptance: { level: "auto", provenance: "claimed", summary: "AI node completed without configured acceptance." } } : result;
  }
  if (acceptance.level === "none") {
    return { ...result, acceptance: { level: "none", provenance: "checked", summary: acceptance.reason ?? "Acceptance disabled." } };
  }
  if (acceptance.level === "verified") {
    for (const verify of acceptance.verify ?? []) {
      const r = await deps.exec("bash", ["-lc", verify.command], { cwd: deps.projectDir, timeout: verify.timeout_ms });
      if (r.code !== 0) {
        return { ...result, status: "failed", error: `Acceptance verify failed: ${verify.id}`, acceptance: { level: acceptance.level, provenance: "rejected", summary: r.stderr || r.stdout || `Command failed: ${verify.command}` } };
      }
    }
    return { ...result, acceptance: { level: acceptance.level, provenance: "verified", summary: "All verification commands passed." } };
  }
  return { ...result, acceptance: { level: acceptance.level, provenance: acceptance.level, summary: "Acceptance recorded." } };
}
```

- [ ] **Step 4: Invoke acceptance from DAG executor**

In `agent/extensions/daddy/lib/dag-executor.ts`, import:

```ts
import { applyAcceptance } from "./acceptance.ts";
```

Change `executeNode` after dispatch:

```ts
const r = await dispatchNode(rctx);
const accepted = await applyAcceptance({ ...state, name: state.workflow, description: state.workflow, nodes: [] } as never, node, r, deps);
if (accepted.status === "failed") throw new Error(accepted.error ?? "node failed");
return accepted;
```

Then improve this immediately by passing the real `WorkflowDef` into `executeNode`:

```ts
async function executeNode(def: WorkflowDef, node: NodeDef, state: RunState, deps: RunDeps): Promise<NodeResult> {
  const rctx: RunCtx = { node, state, deps, sub: buildSubContext(state, deps), cwd: state.worktree?.path ?? deps.projectDir };
  const retryable = (k: "fatal" | "transient" | "unknown") => (node.retry?.on_error === "all" ? k !== "fatal" : k === "transient");
  return withRetry(async () => {
    const r = await dispatchNode(rctx);
    const accepted = await applyAcceptance(def, node, r, deps);
    if (accepted.status === "failed") throw new Error(accepted.error ?? "node failed");
    return accepted;
  }, node.retry, retryable).catch((e) => ({ status: "failed", output: "", error: e instanceof Error ? e.message : String(e) }));
}
```

Update the call site to `executeNode(def, node, state, deps)`.

- [ ] **Step 5: Persist acceptance in node state**

In `mark` inside `agent/extensions/daddy/lib/dag-executor.ts`, include `acceptance: r.acceptance` in the assigned node state.

- [ ] **Step 6: Show acceptance in summaries**

In `agent/extensions/daddy/lib/summary.ts`, update node line:

```ts
const acceptance = n.acceptance ? ` [${n.acceptance.provenance}]` : "";
lines.push(`${statusIcon(n.status)} ${id}: ${n.status}${acceptance}${head ? ` — ${head}` : ""}`);
```

- [ ] **Step 7: Run acceptance and executor tests**

Run: `bun test agent/extensions/daddy/lib/acceptance.test.ts agent/extensions/daddy/lib/dag-executor.test.ts agent/extensions/daddy/lib/summary.test.ts`

Expected: all pass. If `summary.test.ts` asserts exact node summary lines, update the expected line to include the acceptance provenance suffix shown in Step 6, for example `✓ implement: completed [verified] — Done`.

---

### Task 9: Add Preflight Report

**Files:**
- Create: `agent/extensions/daddy/lib/preflight.ts`
- Create: `agent/extensions/daddy/lib/preflight.test.ts`
- Modify: `agent/extensions/daddy/lib/handle-command.ts`

- [ ] **Step 1: Write failing preflight tests**

Create `agent/extensions/daddy/lib/preflight.test.ts`:

```ts
import { expect, test } from "bun:test";
import { buildPreflightReport } from "./preflight.ts";
import type { WorkflowDef } from "../types.ts";

test("preflight summarizes DAG and side effects", () => {
  const def: WorkflowDef = {
    name: "ship", description: "ship", worktree: true,
    nodes: [
      { id: "test", bash: "bun test" },
      { id: "pr", bash: "gh pr create", depends_on: ["test"] },
    ],
  };
  const text = buildPreflightReport(def, "#42");
  expect(text).toContain("Preflight: ship");
  expect(text).toContain("worktree: enabled");
  expect(text).toContain("test -> pr");
  expect(text).toContain("side effects: gh pr create");
  expect(text).toContain("warning: no acceptance configured");
});
```

- [ ] **Step 2: Run test and verify failure**

Run: `bun test agent/extensions/daddy/lib/preflight.test.ts`

Expected: module not found.

- [ ] **Step 3: Implement preflight formatter**

Create `agent/extensions/daddy/lib/preflight.ts`:

```ts
import type { NodeDef, WorkflowDef } from "../types.ts";

function nodeText(node: NodeDef): string {
  return [node.bash, node.cancel, node.prompt, node.command, node.loop?.prompt, node.script?.inline].filter(Boolean).join("\n");
}

function sideEffects(def: WorkflowDef): string[] {
  const hits = new Set<string>();
  for (const node of def.nodes) {
    const text = nodeText(node);
    if (/gh\s+pr\s+create/.test(text)) hits.add("gh pr create");
    if (/gh\s+pr\s+merge/.test(text)) hits.add("gh pr merge");
    if (/wt\s+merge/.test(text)) hits.add("wt merge");
    if (/rm\s+-rf/.test(text)) hits.add("rm -rf");
  }
  return Array.from(hits);
}

function edges(def: WorkflowDef): string[] {
  const result: string[] = [];
  for (const node of def.nodes) {
    for (const dep of node.depends_on ?? []) result.push(`${dep} -> ${node.id}`);
  }
  return result;
}

export function buildPreflightReport(def: WorkflowDef, args: string): string {
  const effects = sideEffects(def);
  const lines = [
    `Preflight: ${def.name}`,
    def.description,
    `arguments: ${args || "(none)"}`,
    `worktree: ${def.worktree ? "enabled" : "disabled"}`,
    `concurrency: ${def.concurrency ?? 4}`,
    "",
    "Nodes",
    ...def.nodes.map((node) => `- ${node.id}${node.depends_on?.length ? ` after ${node.depends_on.join(", ")}` : ""}`),
    "",
    "Edges",
    ...(edges(def).length ? edges(def) : ["none"]),
    "",
    `side effects: ${effects.length ? effects.join(", ") : "none detected"}`,
  ];
  if (!def.acceptance && def.nodes.every((node) => !node.acceptance)) lines.push("warning: no acceptance configured");
  return lines.join("\n");
}
```

- [ ] **Step 4: Wire preflight command**

In `agent/extensions/daddy/lib/handle-command.ts`, import:

```ts
import { buildPreflightReport } from "./preflight.ts";
```

Add case:

```ts
case "preflight": {
  const def = loadDef(p.flow, deps);
  return report(buildPreflightReport(def, p.args));
}
```

- [ ] **Step 5: Run tests**

Run: `bun test agent/extensions/daddy/lib/preflight.test.ts agent/extensions/daddy/lib/handle-command.test.ts`

Expected: all pass.

---

### Task 10: Add Cleanup Listing

**Files:**
- Modify: `agent/extensions/daddy/lib/run-control.ts`
- Modify: `agent/extensions/daddy/lib/run-control.test.ts`
- Modify: `agent/extensions/daddy/lib/handle-command.ts`

- [ ] **Step 1: Write failing cleanup test**

Add to `agent/extensions/daddy/lib/run-control.test.ts`:

```ts
test("cleanupReport lists old terminal runs without deleting", () => {
  const h = home();
  saveRun(h, { id: "old", workflow: "w", arguments: "", status: "completed", artifacts_dir: "/a", base_branch: "main", started_at: "2020-01-01T00:00:00.000Z", completed_at: "2020-01-01T00:01:00.000Z", nodes: {} });
  const text = cleanupReport(h, new Date("2026-06-16T00:00:00.000Z"));
  expect(text).toContain("Cleanup candidates");
  expect(text).toContain("old completed");
});
```

- [ ] **Step 2: Implement read-only cleanup report**

Add to `agent/extensions/daddy/lib/run-control.ts`:

```ts
export function cleanupReport(home: string, now = new Date()): string {
  const cutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const candidates = listRuns(home).filter((run) =>
    ["completed", "failed", "cancelled"].includes(run.status) && Date.parse(run.completed_at ?? run.started_at) < cutoff,
  );
  if (candidates.length === 0) return "No cleanup candidates.";
  return ["Cleanup candidates", ...candidates.map((run) => `- ${run.id} ${run.status} ${run.workflow}`)].join("\n");
}
```

Import `listRuns` from `./state.ts`.

- [ ] **Step 3: Wire cleanup command as read-only**

In `handle-command.ts`, add:

```ts
case "cleanup": return report(cleanupReport(deps.home));
```

Do not delete files in this first implementation. Safe deletion can be added behind an explicit flag later.

- [ ] **Step 4: Run tests**

Run: `bun test agent/extensions/daddy/lib/run-control.test.ts agent/extensions/daddy/lib/handle-command.test.ts`

Expected: all pass.

---

### Task 11: Update Panel With Contextual Hints

**Files:**
- Modify: `agent/extensions/daddy/panel/component.ts`
- Modify: `agent/extensions/daddy/panel/tests/component.test.ts`

- [ ] **Step 1: Write failing panel test**

Add to `agent/extensions/daddy/panel/tests/component.test.ts`:

```ts
test("renders contextual actions for paused runs", () => {
  const { panel, store } = makePanel(20);
  store.setRun({ id: "r1", workflow: "w", arguments: "", status: "paused", paused_node: "gate", artifacts_dir: "/a", base_branch: "main", started_at: "t", nodes: { gate: { status: "paused", output: "Approve?" } } });
  const lines = panel.render(100).join("\n");
  expect(lines).toContain("Actions: approve | reject | cancel");
});
```

Adjust `makePanel` helper usage to match current test helpers.

- [ ] **Step 2: Implement action hint helper**

In `panel/component.ts`, add:

```ts
function actionHint(status: string | undefined): string {
  switch (status) {
    case "paused": return "Actions: approve | reject | cancel";
    case "failed": return "Actions: status | retry | recover | cancel";
    case "completed": return "Actions: status | merge/remove if worktree";
    case "running": return "Actions: status | cancel";
    default: return "Actions: status";
  }
}
```

Then include it in the header row or a bottom row without changing layout drastically:

```ts
rows.push(frameRow(pad("Nodes", leftWidth) + GAP + pad(`Output: ${selectedNodeId ?? "none"} · Model: ${selectedModel} · ${actionHint(state.run?.status)}`, rightWidth), width));
```

- [ ] **Step 3: Run panel test**

Run: `bun test agent/extensions/daddy/panel/tests/component.test.ts`

Expected: all pass.

---

### Task 12: Update README

**Files:**
- Modify: `agent/extensions/daddy/README.md`

- [ ] **Step 1: Update command table**

Add rows for:

```md
| `status [id]`        | `/daddy status mqb…`       | Show a detailed run report when an id is provided.                                                      |
| `doctor`             | `/daddy doctor`            | Diagnose workflows, runs, artifacts, dependencies, and stale state.                                     |
| `cancel [id] [why]`  | `/daddy cancel mqb stuck`  | Mark a run cancelled and preserve artifacts.                                                           |
| `recover <id>`       | `/daddy recover mqb…`      | Reconcile stale running state into an inspectable failed run.                                           |
| `retry <id> <node>`  | `/daddy retry mqb test`    | Reset a failed node and downstream nodes so the run can resume from there.                              |
| `cleanup`            | `/daddy cleanup`           | List old terminal runs/artifacts that are safe cleanup candidates.                                      |
| `preflight <name>`   | `/daddy preflight fix-issue #42` | Preview a workflow DAG, side effects, and warnings without running it.                            |
```

- [ ] **Step 2: Add acceptance section**

Document the `acceptance` example from the spec and define `none`, `attested`, `checked`, `verified`, `reviewed`.

- [ ] **Step 3: Correct limitations**

Remove or rewrite the stale limitation saying custom TUI panel is deferred. The panel exists; remaining limitation should say the panel is evolving and does not yet provide full preflight editing.

- [ ] **Step 4: Run docs-adjacent tests**

Run: `bun test agent/extensions/daddy/tests/bundled.test.ts`

Expected: bundled workflow tests still pass.

---

## Final Verification

- [ ] Run focused unit tests touched in this plan:

```bash
bun test agent/extensions/daddy/lib/command-router.test.ts agent/extensions/daddy/lib/state.test.ts agent/extensions/daddy/lib/status-report.test.ts agent/extensions/daddy/lib/doctor.test.ts agent/extensions/daddy/lib/run-control.test.ts agent/extensions/daddy/lib/validator.test.ts agent/extensions/daddy/lib/acceptance.test.ts agent/extensions/daddy/lib/preflight.test.ts agent/extensions/daddy/lib/handle-command.test.ts
```

Expected: all pass.

- [ ] Run panel tests touched in this plan:

```bash
bun test agent/extensions/daddy/panel/tests/component.test.ts
```

Expected: all pass.

- [ ] Run the extension unit suite:

```bash
bun test agent/extensions/daddy
```

Expected: all non-integration tests pass.

- [ ] Run typecheck:

```bash
npm --prefix agent/extensions/daddy run typecheck
```

Expected: `tsc --noEmit` exits 0.

Do not run build commands. Do not commit unless the user explicitly asks.

## Delivery Notes

The first useful shipped slice is Tasks 1-6 plus README updates: parser, deep status, doctor, cancel, recover, retry reset, cleanup report. Acceptance and preflight can follow once lifecycle reliability is stable.
