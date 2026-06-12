// subagent — registers a tool that runs an array of agents as isolated `pi` subprocesses,
// honoring per-agent dependsOn as a dependency graph (independent agents run in parallel).
import { fileURLToPath } from "node:url";
import type { AgentToolResult, ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { SUBAGENT_GUIDELINES, SUBAGENT_SNIPPET } from "./constants.ts";
import { loadConfig } from "./lib/config.ts";
import { executeSubagent } from "./lib/execute.ts";
import { installTrigger } from "./panel/trigger.ts";
import type { SubagentDetails } from "./result.ts";
import { SubagentParams } from "./schema.ts";
import type { AgentSpec } from "./types.ts";
import { renderCall } from "./ui/render-call.ts";
import { renderResult } from "./ui/render-result.ts";

const DESCRIPTION = [
	"Run an array of agents, each in an isolated pi process with its own context window.",
	"Per agent: name, prompt (REQUIRED — the task, sent as the user message), provider, model,",
	"variant (low|medium|high reasoning effort, required), optional instructions (the system prompt —",
	"behavior/persona/tone/rigid rules only, NOT the task), optional context (supporting material sent with the prompt),",
	"optional blockedTools (denylist; ask_user_question is always blocked), optional dependsOn.",
	"Agents without dependsOn run in parallel; dependsOn forms a dependency graph — a dependent starts after its",
	"dependencies finish and receives their outputs as context. Pass context ONLY when it adds value (saves tokens).",
].join(" ");

export default function subagent(pi: ExtensionAPI): void {
	// Registry of flags announced by other extensions over the shared event bus
	// (the `flag:registered` convention, see flag-autocomplete). pi has no public API
	// to enumerate flags, and getFlag only reads this extension's own flags — so this
	// event is the only way to learn which flags a child subagent might intercept.
	const knownFlags = new Map<string, string>();
	pi.events.on("flag:registered", (data: unknown) => {
		const d = data as { token?: unknown; description?: unknown };
		if (typeof d?.token === "string") knownFlags.set(d.token, typeof d.description === "string" ? d.description : "");
	});

	pi.registerTool({
		name: "subagent",
		label: "Subagent",
		description: DESCRIPTION,
		promptSnippet: SUBAGENT_SNIPPET,
		promptGuidelines: SUBAGENT_GUIDELINES,
		parameters: SubagentParams,
		execute: async (_id, params, signal, onUpdate, ctx) => {
			console.error(`[subagent-entry] ctx=${JSON.stringify({ cwd: ctx?.cwd, hasUI: ctx?.hasUI, ctxType: typeof ctx })}`);
			try {
				return await executeSubagent(
					(params as { agents: AgentSpec[] }).agents,
					pi.getAllTools().map((t) => t.name),
					signal,
					onUpdate,
					ctx,
					knownFlags,
				);
			} catch (err: any) {
				console.error(`[subagent-entry] CAUGHT ERROR: ${err?.message ?? err}`);
				return { content: [{ type: "text", text: `subagent error: ${err?.message ?? err}` }] };
			}
		},
		renderCall: (args, theme) => renderCall(args as { agents?: AgentSpec[] }, theme),
		renderResult: (result, options, theme) => renderResult(result as AgentToolResult<SubagentDetails>, options, theme),
	});

	// Install the double-press panel trigger once, when an interactive UI is available.
	// Hook two early events so installation is guaranteed by the first prompt at latest.
	const config = loadConfig(fileURLToPath(new URL("./config.yml", import.meta.url)));
	let installed = false;
	const ensureTrigger = (ctx: ExtensionContext) => {
		if (installed || !ctx.hasUI) return;
		installed = true;
		installTrigger(ctx, config);
	};
	pi.on("session_start", (_event, ctx) => ensureTrigger(ctx));
	pi.on("before_agent_start", (_event, ctx) => ensureTrigger(ctx));
}
