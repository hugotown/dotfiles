import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { createInitialState, transition, type PipelineEvent, type PipelineState } from "./state.ts";
import {
	applyPhaseConfig,
	captureDefaults,
	drivePhase,
	filterContext,
	persist,
	restore,
	restoreDefaults,
} from "./orchestrator.ts";
import { gatherContext } from "./context/gather.ts";
import { compressContext } from "./context/compress.ts";
import { artifactFolderFor } from "./lib/paths.ts";
import { onBrainstormEnd, startBrainstorm } from "./phases/brainstorm.ts";
import { onSpecEnd, specPathFor, startSpec, startSpecReview } from "./phases/spec.ts";
import {
	planFileValid,
	planPathFor,
	readTasks,
	runResearch,
	startPlanAuthor,
	startPlanResearch,
	startPlanReview,
} from "./phases/plan.ts";
import {
	gatherLibraryNotes,
	librariesFromResearch,
	MAX_LIBRARY_ATTEMPTS,
	parseConfidence,
	startLibraryResearch,
} from "./phases/library.ts";
import { startCurrentTask, verifyTask } from "./phases/implement.ts";
import { parseVerdict, startReview } from "./phases/review.ts";
import { notesFileValid, startNotes } from "./phases/notes.ts";

export default function devPipeline(pi: ExtensionAPI): void {
	let state: PipelineState | null = null;
	// Probes captured during context gathering, needed later by the research phase.
	let probes = { astGrep: false, graphify: false };

	const PIPELINE_FLAG_DESCRIPTION = "Run the deterministic dev pipeline for <activity>";

	pi.registerFlag("pipeline", {
		type: "string",
		description: PIPELINE_FLAG_DESCRIPTION,
	});

	// --- Trigger (FR-1) ---
	pi.on("input", async (event, ctx) => {
		if (event.source === "extension") return { action: "continue" }; // ignore our own injected msgs (no loops)
		if (!event.text.includes("--pipeline")) return { action: "continue" };
		const activity = event.text.split("--pipeline").join("").trim();
		await startPipeline(pi, ctx, activity);
		return { action: "handled" };
	});

	// --- /pipeline alias (FR-1) ---
	pi.registerCommand("pipeline", {
		description: PIPELINE_FLAG_DESCRIPTION,
		handler: async (args, ctx) => {
			await startPipeline(pi, ctx as unknown as ExtensionContext, args.trim());
		},
	});

	async function startPipeline(api: ExtensionAPI, ctx: ExtensionContext, activity: string): Promise<void> {
		if (!ctx.hasUI) {
			ctx.ui.notify("dev-pipeline requires an interactive UI.", "error");
			return;
		}
		if (!activity) {
			ctx.ui.notify("Usage: --pipeline <activity>", "warning");
			return;
		}
		state = captureDefaults(api, ctx, createInitialState(activity));
		await advance(api, ctx, { type: "START" });
	}

	// --- Fresh context per phase (FR-28) ---
	pi.on("context", async (event) => {
		if (!state || state.phase === "IDLE" || state.phase === "COMPLETE") return;
		return { messages: filterContext(event.messages as unknown[], state.phase) as typeof event.messages };
	});

	// --- The dispatcher: each agent_end maps to the active phase (FR-2, §6) ---
	pi.on("agent_end", async (event, ctx) => {
		if (!state) return;
		const lastText = lastAssistantText(event.messages as unknown[]);

		switch (state.phase) {
			case "BRAINSTORM": {
				const ev = await onBrainstormEnd(pi, ctx, state, lastText);
				await advance(pi, ctx, ev);
				break;
			}
			case "SPEC": {
				if (!(await onSpecEnd(pi, ctx, state))) {
					await advance(pi, ctx, { type: "RESET" });
					break;
				}
				await advance(pi, ctx, { type: "SPEC_WRITTEN", specPath: specPathFor(state) });
				break;
			}
			case "SPEC_SELF_REVIEW": {
				await advance(pi, ctx, { type: "REVIEWED" });
				break;
			}
			case "PLAN_RESEARCH": {
				const libraries = await librariesFromResearch(pi, state);
				await advance(pi, ctx, { type: "RESEARCH_DECIDED", libraries });
				break;
			}
			case "LIBRARY_RESEARCH": {
				const confidence = parseConfidence(lastText);
				if (confidence === "high") {
					await advance(pi, ctx, { type: "LIBRARY_DONE", confidence });
					break;
				}
				if (state.libraryAttempts + 1 >= MAX_LIBRARY_ATTEMPTS) {
					const name = state.libraries[state.currentLibraryIndex]?.name ?? "(unknown)";
					ctx.ui.notify(
						`Library '${name}' stayed at '${confidence}' confidence after ${MAX_LIBRARY_ATTEMPTS} attempts — proceeding.`,
						"warning",
					);
					await advance(pi, ctx, { type: "LIBRARY_DONE", confidence });
					break;
				}
				await advance(pi, ctx, { type: "LIBRARY_RETRY" });
				break;
			}
			case "PLAN_AUTHOR": {
				if (!(await planFileValid(pi, state))) {
					ctx.ui.notify("Plan phase produced no file — halting (NFR-2).", "error");
					await advance(pi, ctx, { type: "RESET" });
					break;
				}
				const tasks = await readTasks(pi, state);
				if (tasks.length === 0) {
					ctx.ui.notify("Plan produced no parseable '### Task N:' headings — halting (NFR-2).", "error");
					await advance(pi, ctx, { type: "RESET" });
					break;
				}
				await advance(pi, ctx, { type: "PLAN_WRITTEN", planPath: planPathFor(state), tasks });
				break;
			}
			case "PLAN_SELF_REVIEW": {
				await advance(pi, ctx, { type: "REVIEWED" });
				break;
			}
			case "IMPLEMENT": {
				const outcome = await verifyTask(pi, lastText);
				if (outcome === "blocked") {
					ctx.ui.notify(`Task ${state.currentTaskIndex + 1} BLOCKED — halting (FR-24).`, "error");
					await advance(pi, ctx, { type: "BLOCKED" });
					break;
				}
				await advance(pi, ctx, { type: "TASK_DONE" });
				break;
			}
			case "REVIEW": {
				await advance(pi, ctx, { type: "REVIEWED_CODE", verdict: parseVerdict(lastText) });
				break;
			}
			case "NOTES": {
				if (!(await notesFileValid(pi, state))) {
					ctx.ui.notify("Notes phase produced no file — halting (NFR-2).", "error");
					await advance(pi, ctx, { type: "RESET" });
					break;
				}
				await advance(pi, ctx, { type: "NOTES_WRITTEN", notesPath: "" });
				break;
			}
		}
	});

	// --- Resume on session start (FR-4 / NFR-4) ---
	pi.on("session_start", async (event, ctx) => {
		// Announce the flag for the flag-autocomplete extension. Emitted here (not at load)
		// because the EventBus does not replay: if dev-pipeline loads before flag-autocomplete
		// (it does — readdir order), a load-time emit is missed. By session_start every
		// extension has attached its listeners, and flag-autocomplete reads the flag map lazily.
		pi.events.emit("flag:registered", {
			token: "--pipeline",
			description: PIPELINE_FLAG_DESCRIPTION,
		});

		if (event.reason !== "resume" && event.reason !== "reload") return;
		const restored = restore(ctx);
		if (restored && restored.phase !== "IDLE" && restored.phase !== "COMPLETE") {
			state = restored;
			ctx.ui.notify(`dev-pipeline resumed at phase: ${state.phase}`, "info");
			await driveCurrentPhase(pi, ctx);
		}
	});

	/**
	 * Apply an event, persist, then perform the side effects for the NEW phase.
	 * Deterministic phases (GATHERING_CONTEXT, gates, research execution, IMPLEMENT advance)
	 * are handled here without LLM tokens.
	 */
	async function advance(api: ExtensionAPI, ctx: ExtensionContext, event: PipelineEvent): Promise<void> {
		if (!state) return;
		state = transition(state, event);
		persist(api, state);
		await driveCurrentPhase(api, ctx);
	}

	async function driveCurrentPhase(api: ExtensionAPI, ctx: ExtensionContext): Promise<void> {
		if (!state) return;
		switch (state.phase) {
			case "GATHERING_CONTEXT": {
				ctx.ui.setStatus("dev-pipeline", "📦 gathering context");
				const folder = artifactFolderFor(ctx.cwd);
				await api.exec("mkdir", ["-p", folder]); // FR-5: create if absent
				const gathered = await gatherContext((c, a, o) => api.exec(c, a, o), ctx.cwd);
				probes = { astGrep: gathered.astGrep, graphify: gathered.graphify };
				const compressed = compressContext({ stack: gathered.stack, probes: gathered.probes, tree: gathered.tree });
				await advance(api, ctx, { type: "CONTEXT_READY", compressedContext: compressed, artifactFolder: folder });
				break;
			}
			case "BRAINSTORM":
				await startBrainstorm(api, ctx, state);
				break;
			case "SPEC":
				await startSpec(api, ctx, state);
				break;
			case "SPEC_SELF_REVIEW":
				await startSpecReview(api, ctx, state);
				break;
			case "PLAN_RESEARCH":
				await startPlanResearch(api, ctx, state);
				break;
			case "LIBRARY_RESEARCH":
				if (state.currentLibraryIndex >= state.libraries.length) {
					await advance(api, ctx, { type: "ALL_LIBRARIES_DONE" });
				} else {
					await startLibraryResearch(api, ctx, state);
				}
				break;
			case "PLAN_AUTHOR": {
				// Deterministic base research + per-library notes run BEFORE the author prompt (FR-18).
				const results = await runResearch(api, state, probes);
				const libraryNotes = await gatherLibraryNotes(api, state);
				await startPlanAuthor(api, ctx, state, results, libraryNotes);
				break;
			}
			case "PLAN_SELF_REVIEW":
				await startPlanReview(api, ctx, state);
				break;
			case "IMPLEMENT":
				if (state.currentTaskIndex >= state.tasks.length) {
					await advance(api, ctx, { type: "ALL_TASKS_DONE" });
				} else {
					await startCurrentTask(api, ctx, state);
				}
				break;
			case "REVIEW":
				await startReview(api, ctx, state);
				break;
			case "NOTES":
				await startNotes(api, ctx, state);
				break;
			case "BLOCKED":
				ctx.ui.notify("Pipeline halted (BLOCKED). Review the working tree and re-run when ready.", "warning");
				await restoreDefaults(api, ctx, state);
				ctx.ui.setStatus("dev-pipeline", undefined);
				break;
			case "COMPLETE":
				ctx.ui.notify(`Pipeline complete. Verdict: ${state.reviewVerdict}. Artifacts in the Obsidian folder.`, "info");
				await restoreDefaults(api, ctx, state);
				ctx.ui.setStatus("dev-pipeline", undefined);
				break;
			case "IDLE":
				// Reached via RESET/cancel: restore session defaults.
				await restoreDefaults(api, ctx, state);
				ctx.ui.setStatus("dev-pipeline", undefined);
				break;
		}
	}
}

/** Best-effort extraction of the last assistant text from agent_end messages (structural, no extra deps). */
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
