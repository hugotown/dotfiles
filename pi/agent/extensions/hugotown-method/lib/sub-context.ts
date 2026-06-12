// lib/sub-context.ts — Build a SubContext (builtins + completed node outputs) from RunState.
import type { RunState, SubContext, RunDeps } from "../runtime-types.ts";

export function buildSubContext(state: RunState, deps: RunDeps): SubContext {
  const builtins: Record<string, string> = {
    ARGUMENTS: state.arguments,
    ARTIFACTS_DIR: state.artifacts_dir,
    BASE_BRANCH: state.base_branch,
    WORKFLOW_ID: state.id,
    RUN_DIR: `${deps.home}/runs`,
    DOCS_DIR: "docs",
  };
  const nodeOutputs: Record<string, string> = {};
  const nodeStructured: Record<string, unknown> = {};
  for (const [id, n] of Object.entries(state.nodes)) {
    if (n.status !== "completed") continue;
    nodeOutputs[id] = n.output;
    if (n.structured !== undefined) nodeStructured[id] = n.structured;
  }
  return { builtins, nodeOutputs, nodeStructured };
}
