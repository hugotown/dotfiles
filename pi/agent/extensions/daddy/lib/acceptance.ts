import type { NodeResult, RunDeps } from "../runtime-types.ts";
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
