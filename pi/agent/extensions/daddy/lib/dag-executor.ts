// lib/dag-executor.ts — Execute a workflow DAG: layers, gates, retry, pause/cancel, persistence.
import { toLayers } from "./topo-sort.ts";
import { shouldExecute } from "./trigger-rule.ts";
import { evaluateCondition } from "./condition-eval.ts";
import { buildSubContext } from "./sub-context.ts";
import { dispatchNode } from "../nodes/dispatch.ts";
import { withRetry } from "./retry.ts";
import { createSemaphore } from "./semaphore.ts";
import { saveRun } from "./state.ts";
import { DEFAULT_CONCURRENCY } from "../constants.ts";
import type { WorkflowDef, NodeDef } from "../types.ts";
import type { RunState, RunDeps, NodeResult, RunCtx } from "../runtime-types.ts";

const nowIso = () => new Date().toISOString();

async function executeNode(node: NodeDef, state: RunState, deps: RunDeps): Promise<NodeResult> {
  const rctx: RunCtx = { node, state, deps, sub: buildSubContext(state, deps), cwd: state.worktree?.path ?? deps.projectDir };
  const retryable = (k: "fatal" | "transient" | "unknown") => (node.retry?.on_error === "all" ? k !== "fatal" : k === "transient");
  return withRetry(async () => {
    const r = await dispatchNode(rctx);
    if (r.status === "failed") throw new Error(r.error ?? "node failed");
    return r;
  }, node.retry, retryable).catch((e) => ({ status: "failed", output: "", error: e instanceof Error ? e.message : String(e) }));
}

function mark(state: RunState, id: string, r: NodeResult): void {
  state.nodes[id] = { status: r.status, output: r.output, structured: r.structured, error: r.error, completed_at: nowIso() };
  if (r.status === "paused") { state.status = "paused"; state.paused_node = id; }
  if (r.status === "cancelled") state.status = "cancelled";
}

export async function executeDag(def: WorkflowDef, state: RunState, deps: RunDeps): Promise<RunState> {
  const sem = createSemaphore(def.concurrency ?? DEFAULT_CONCURRENCY);
  for (const layer of toLayers(def.nodes)) {
    const toRun: NodeDef[] = [];
    for (const node of layer) {
      if (state.nodes[node.id]?.status === "completed" && !node.always_run) continue;
      if (!shouldExecute(node, state.nodes)) { mark(state, node.id, { status: "skipped", output: "" }); continue; }
      if (node.when && !evaluateCondition(node.when, buildSubContext(state, deps))) {
        mark(state, node.id, { status: "skipped", output: "" }); continue;
      }
      toRun.push(node);
    }
    if (toRun.length > 0) {
      for (const node of toRun) state.nodes[node.id] = { status: "running", output: "", started_at: nowIso() };
      deps.emit(state);
      saveRun(deps.home, state);
    }
    const results = await Promise.all(toRun.map((node) =>
      sem.acquire().then(async () => { try { return [node, await executeNode(node, state, deps)] as const; } finally { sem.release(); } })));
    for (const [node, r] of results) { mark(state, node.id, r); if (deps.onStream && r.output) deps.onStream(node.id, r.output); deps.emit(state); }
    saveRun(deps.home, state);
    if (state.status === "paused" || state.status === "cancelled") return state;
  }
  state.status = Object.values(state.nodes).some((n) => n.status === "failed") ? "failed" : "completed";
  state.completed_at = nowIso();
  saveRun(deps.home, state); deps.emit(state);
  return state;
}
