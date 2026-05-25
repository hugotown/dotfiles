// Resolve <name> → read .pi/daddy/workflows/<name>.yaml → parse → normalize.
import { promises as fs } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { WORKFLOW_DIR } from "../constants.ts";
import type { SipocChain, Workflow, WorkflowNode } from "../types.ts";

/** Fill structural defaults so downstream code can assume depends_on is an array. */
export function normalizeWorkflow(raw: Record<string, unknown>): Workflow {
	if (!Array.isArray(raw.vsm)) throw new Error("workflow has no vsm");
	const vsm: SipocChain[] = (raw.vsm as Record<string, unknown>[]).map((chain) => ({
		sipoc: String(chain.sipoc ?? ""),
		supplier: chain.supplier as string | undefined,
		customer: chain.customer as string | undefined,
		nodes: ((chain.nodes as WorkflowNode[]) ?? []).map((n) => ({ ...n, depends_on: n.depends_on ?? [] })),
	}));
	return { name: String(raw.name ?? ""), description: raw.description as string | undefined, vsm };
}

export function workflowPath(cwd: string, name: string): string {
	return path.join(cwd, WORKFLOW_DIR, `${name}.yaml`);
}

/** Names (without .yaml) of every workflow file in the project's workflow dir, sorted. */
export async function listWorkflows(cwd: string): Promise<string[]> {
	try {
		const entries = await fs.readdir(path.join(cwd, WORKFLOW_DIR));
		return entries.filter((f) => f.endsWith(".yaml")).map((f) => f.slice(0, -".yaml".length)).sort();
	} catch {
		return [];
	}
}

export async function loadWorkflow(cwd: string, name: string): Promise<Workflow> {
	const text = await fs.readFile(workflowPath(cwd, name), "utf-8");
	return normalizeWorkflow(parse(text) as Record<string, unknown>);
}
