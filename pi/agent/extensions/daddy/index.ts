// daddy entry. In a child (DADDY_NODE=1) it registers ONLY append_node and installs no
// input handler (prevents recursion). Otherwise it registers the flags and the driver.
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
	ASK_MARKER,
	DADDY_NODE_ENV,
	DADDY_NODE_ID_ENV,
	DADDY_NODE_SCHEMA_ENV,
	FLAG_DESIGN,
	FLAG_FRESH,
	FLAG_WORKFLOW,
} from "./constants.ts";
import { registerAppendTool } from "./lib/append-tool.ts";
import { captureDefaults, type SavedDefaults } from "./lib/delegate-ask.ts";
import { continueRun } from "./lib/driver.ts";
import { findNode } from "./lib/flat-nodes.ts";
import { mergeNodeResult, persistState } from "./lib/state-store.ts";
import { startRun } from "./lib/start-run.ts";
import { publishRun } from "./lib/store.ts";
import { installTrigger } from "./panel/trigger.ts";
import type { StateMachine } from "./types.ts";

export default function daddy(pi: ExtensionAPI): void {
	// --- Child mode: only the append_node tool, nothing else. The expected node id and
	// schema arrive via env set by run-llm-node. No input handler → no recursion. ---
	if (process.env[DADDY_NODE_ENV] === "1") {
		const id = process.env[DADDY_NODE_ID_ENV] ?? "";
		const rawSchema = process.env[DADDY_NODE_SCHEMA_ENV];
		const schema = rawSchema ? (JSON.parse(rawSchema) as Record<string, unknown>) : undefined;
		registerAppendTool(pi, id, schema);
		return;
	}

	let state: StateMachine | null = null;
	let stateFile = "";
	let saved: SavedDefaults | null = null;

	for (const [token, desc] of [
		[FLAG_WORKFLOW, "Execute a daddy workflow (auto-resume). Modifiers: --daddy-fresh, --daddy-design"],
		[FLAG_FRESH, "Run the workflow from scratch, discarding prior state"],
		[FLAG_DESIGN, "Open the panel editing the workflow"],
	] as const) {
		pi.registerFlag(token.slice(2), { description: desc, type: "string" });
	}

	let installed = false;
	const ensureTrigger = (ctx: ExtensionContext): void => {
		if (installed || !ctx.hasUI) return;
		installed = true;
		installTrigger(ctx);
	};
	pi.on("session_start", (_event, ctx) => {
		for (const token of [FLAG_WORKFLOW, FLAG_FRESH, FLAG_DESIGN]) {
			pi.events.emit("flag:registered", { token, description: "daddy" });
		}
		ensureTrigger(ctx);
	});
	pi.on("before_agent_start", (_event, ctx) => ensureTrigger(ctx));

	pi.on("input", async (event, ctx) => {
		if (event.source === "extension") return { action: "continue" }; // never self-trigger
		// Intercept a run (--daddy-workflow) OR a design entry (--daddy-design, standalone or modifier).
		if (!event.text.includes(FLAG_WORKFLOW) && !event.text.includes(FLAG_DESIGN)) return { action: "continue" };
		const started = await startRun(pi, ctx, event.text);
		if (!started) return { action: "handled" }; // notified inside (error, picker, or design)
		state = started.state;
		stateFile = started.file;
		saved = captureDefaults(pi, ctx.model);
		publishRun(state);
		await continueRun(pi, ctx, state, stateFile);
		publishRun(state);
		return { action: "handled" };
	});

	pi.on("agent_end", async (event, ctx) => {
		if (!state) return;
		const running = findNode(state, runningAskId(state));
		if (!running) return;
		mergeNodeResult(state, running.id, { status: "ok", output: lastAssistantText(event.messages as unknown[]) });
		await persistState(stateFile, state);
		await restore(pi, ctx, saved);
		publishRun(state);
		await continueRun(pi, ctx, state, stateFile);
		publishRun(state);
	});

	pi.on("context", async (event) => {
		if (!state || !runningAskId(state)) return;
		return { messages: trimToMarker(event.messages as { customType?: string }[]) as typeof event.messages };
	});
}

function runningAskId(state: StateMachine): string {
	for (const c of state.vsm) for (const n of c.nodes) if (n.action === "ask" && n.aiAssisted && n.status === "running") return n.id;
	return "";
}

function trimToMarker<T extends { customType?: string }>(messages: T[]): T[] {
	for (let i = messages.length - 1; i >= 0; i--) if (messages[i].customType === ASK_MARKER) return messages.slice(i + 1);
	return messages;
}

/** Best-effort extraction of the last assistant text from agent_end messages (structural). */
function lastAssistantText(messages: unknown[]): string {
	for (let i = messages.length - 1; i >= 0; i--) {
		const m = messages[i] as { role?: string; content?: unknown };
		if (m.role !== "assistant") continue;
		if (typeof m.content === "string") return m.content;
		if (Array.isArray(m.content)) {
			return m.content
				.filter((c): c is { type: string; text: string } => (c as { type?: string }).type === "text")
				.map((c) => c.text)
				.join("\n");
		}
	}
	return "";
}

async function restore(pi: ExtensionAPI, ctx: ExtensionContext, saved: SavedDefaults | null): Promise<void> {
	if (!saved) return;
	if (saved.tools.length) pi.setActiveTools(saved.tools);
	if (saved.model) {
		const m = ctx.modelRegistry.find(saved.model.provider, saved.model.id);
		if (m) await pi.setModel(m);
	}
}
