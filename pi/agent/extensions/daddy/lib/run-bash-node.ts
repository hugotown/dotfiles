// bash node: run the EXACT command verbatim (design §10). stdout (truncated) is output;
// non-zero exit → failed. No $ref injection in v1 for bash.
import { exec } from "node:child_process";
import type { NodeResult, NodeState } from "../types.ts";

const MAX_OUTPUT = 20_000;

export function runBashNode(node: NodeState, cwd: string): Promise<NodeResult> {
	return new Promise((resolve) => {
		exec(node.command ?? "", { cwd, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
			const output = (stdout || stderr || "").slice(0, MAX_OUTPUT);
			resolve({ status: err ? "failed" : "ok", output });
		});
	});
}
