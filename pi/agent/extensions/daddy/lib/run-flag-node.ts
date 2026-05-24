// flag node: invoke another extension's flag (e.g. --hello) in a headless child and capture
// its output. The flag is delivered via STDIN, not as a positional: pi's CLI rejects a
// positional message starting with "--" (verified), but the same text piped on stdin reaches
// the input handler and triggers flag interception. We capture the last custom message of any
// type (flags emit a custom message_end), falling back to the latest assistant text.
import { lastAssistantText, lastCustomMessageAny } from "./json-stream.ts";
import { spawnPi } from "./spawn-pi.ts";
import type { NodeResult, NodeState } from "../types.ts";

export async function runFlagNode(node: NodeState, cwd: string): Promise<NodeResult> {
	const invocation = `${node.flag ?? ""} ${node.args ?? ""}`.trim();
	const { lines, stderr, code } = await spawnPi(["--mode", "json", "-p", "--no-session"], cwd, { stdinInput: invocation });
	const output = lastCustomMessageAny(lines) ?? lastAssistantText(lines);
	if (code !== 0 && !output) return { status: "failed", output: stderr.trim() || `flag exited ${code}` };
	return { status: "ok", output };
}
