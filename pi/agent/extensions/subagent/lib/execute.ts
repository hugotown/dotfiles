// Orchestrates a subagent tool call: validate the graph, run it, stream live updates,
// and assemble the final result. Keeps index.ts to pure registration.
import type { AgentToolResult, AgentToolUpdateCallback, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { type AgentResult, pendingResult, type SubagentDetails } from "../result.ts";
import type { AgentSpec } from "../types.ts";
import { runGraph } from "./run-graph.ts";
import { runAgentProcess } from "./runner.ts";
import { publishRun } from "./store.ts";
import { buildSummary } from "./summary.ts";
import { describeGraphError, validateGraph } from "./validate.ts";

const CONCURRENCY = 4;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Registered flag tokens (e.g. "--hello") present as standalone tokens in the agent's prompt/context. */
function detectFlags(spec: AgentSpec, knownFlags: ReadonlyMap<string, string>): string[] | undefined {
	const haystack = `${spec.prompt} ${spec.context ?? ""}`;
	const found = [...knownFlags.keys()].filter((token) => new RegExp(`(^|\\s)${escapeRegex(token)}(?=\\s|$)`).test(haystack));
	return found.length > 0 ? found : undefined;
}

export async function executeSubagent(
	agents: AgentSpec[],
	toolUniverse: string[],
	signal: AbortSignal | undefined,
	onUpdate: AgentToolUpdateCallback<SubagentDetails> | undefined,
	ctx: ExtensionContext,
	knownFlags: ReadonlyMap<string, string>,
): Promise<AgentToolResult<SubagentDetails>> {
	const graphError = validateGraph(agents);
	if (graphError) {
		return { content: [{ type: "text", text: describeGraphError(graphError) }], details: { results: [] } };
	}

	const live = agents.map(pendingResult);
	const indexByName = new Map(agents.map((a, i) => [a.name, i]));
	const emit = () => {
		publishRun(live); // feed the panel's state machine
		if (!onUpdate) return;
		const done = live.filter((r) => r.status !== "pending" && r.status !== "running").length;
		const running = live.filter((r) => r.status === "running").length;
		const text = `${done}/${live.length} done${running ? `, ${running} running` : ""}`;
		onUpdate({ content: [{ type: "text", text }], details: { results: [...live] } });
	};
	const set = (r: AgentResult) => {
		live[indexByName.get(r.name)!] = r;
		emit();
	};
	emit(); // publish the initial pending snapshot

	await runGraph(
		agents,
		async (spec, deps) => {
			const r = await runAgentProcess(spec, deps, toolUniverse, ctx.cwd, signal, { onPartial: set });
			r.flagsInPrompt = detectFlags(spec, knownFlags);
			set(r);
			return r;
		},
		(spec, reason) => {
			const r: AgentResult = { ...pendingResult(spec), status: "skipped", skippedReason: reason, flagsInPrompt: detectFlags(spec, knownFlags) };
			set(r);
			return r;
		},
		CONCURRENCY,
	);

	return { content: [{ type: "text", text: buildSummary(live) }], details: { results: [...live] } };
}
