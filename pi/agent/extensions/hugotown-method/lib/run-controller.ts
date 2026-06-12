// lib/run-controller.ts — Start or resume a workflow run end-to-end.
import * as fs from "node:fs";
import * as path from "node:path";
import { findWorkflow } from "./discovery.ts";
import { parseWorkflow } from "./loader.ts";
import { validateWorkflow } from "./validator.ts";
import { detectBaseBranch } from "./git-info.ts";
import { createArtifactsDir } from "./artifacts.ts";
import { wtCreate } from "./wt.ts";
import { makeBranchName } from "./branch-name.ts";
import { saveRun, loadRun } from "./state.ts";
import { executeDag } from "./dag-executor.ts";
import type { WorkflowDef } from "../types.ts";
import type { RunState, RunDeps } from "../runtime-types.ts";

export interface Approval { decision: "approve" | "reject"; comment?: string; }

const dirsFor = (deps: RunDeps): string[] => [path.join(deps.projectDir, ".hugotown"), deps.bundledDir];

export function loadDef(workflow: string, deps: RunDeps): WorkflowDef {
  const file = findWorkflow(workflow, dirsFor(deps));
  if (!file) throw new Error(`Workflow "${workflow}" not found`);
  const def = parseWorkflow(fs.readFileSync(file, "utf-8"));
  const err = validateWorkflow(def);
  if (err) throw new Error(`Invalid workflow: ${err}`);
  return def;
}

export async function startRun(flow: string, args: string, deps: RunDeps): Promise<RunState> {
  const def = loadDef(flow, deps);
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const state: RunState = {
    id, workflow: flow, arguments: args, status: "running",
    artifacts_dir: createArtifactsDir(deps.home, id),
    base_branch: await detectBaseBranch(deps.exec, deps.projectDir),
    started_at: new Date().toISOString(),
    nodes: Object.fromEntries(def.nodes.map((n) => [n.id, { status: "pending", output: "" }])),
  };
  if (def.worktree) {
    const branch = makeBranchName(flow);
    state.worktree = { branch, ...(await wtCreate(deps.exec, branch, deps.projectDir)) };
  }
  saveRun(deps.home, state);
  return executeDag(def, state, deps);
}

export async function resumeRun(id: string, deps: RunDeps, approval?: Approval): Promise<RunState> {
  const state = loadRun(deps.home, id);
  if (!state) throw new Error(`Run "${id}" not found`);
  const def = loadDef(state.workflow, deps);
  if (approval && state.paused_node) {
    const gate = state.paused_node;
    const reject = approval.decision === "reject";
    const onReject = def.nodes.find((n) => n.id === gate)?.approval?.on_reject;
    if (reject && onReject === "abort") { state.status = "cancelled"; saveRun(deps.home, state); return state; }
    state.nodes[gate] = { status: "completed", output: reject ? "rejected" : approval.comment || "approved", completed_at: new Date().toISOString() };
    state.paused_node = undefined;
  }
  state.status = "running";
  return executeDag(def, state, deps);
}
