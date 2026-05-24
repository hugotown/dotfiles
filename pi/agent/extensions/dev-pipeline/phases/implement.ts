import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { applyPhaseConfig, drivePhase } from "../orchestrator.ts";
import { implementTaskPrompt } from "../lib/prompts.ts";
import { planPathFor } from "./plan.ts";
import type { PipelineState } from "../state.ts";

/** Inject the prompt for the current task. */
export async function startCurrentTask(pi: ExtensionAPI, ctx: ExtensionContext, s: PipelineState): Promise<void> {
	const task = s.tasks[s.currentTaskIndex];
	if (!task) return;
	ctx.ui.setStatus("dev-pipeline", `⚙️ implement ${s.currentTaskIndex + 1}/${s.tasks.length}`);
	if (!(await applyPhaseConfig(pi, ctx, "IMPLEMENT"))) return;
	drivePhase(pi, implementTaskPrompt(s, planPathFor(s), task.title, task.id));
}

/**
 * FR-24 + design §9.2: verify the task deterministically. Returns:
 * - "done" if the detected test command passes,
 * - "blocked" if the LLM declared BLOCKED or tests fail.
 * Detects the test command from the project's package.json (scripts.test) and falls back to `bun test`.
 */
export async function verifyTask(pi: ExtensionAPI, lastAssistantText: string): Promise<"done" | "blocked"> {
	if (/^\s*BLOCKED:/m.test(lastAssistantText)) return "blocked";
	const cmd = await detectTestCommand(pi);
	try {
		const r = await pi.exec(cmd.command, cmd.args, { timeout: 120000 });
		return r.code === 0 ? "done" : "blocked";
	} catch {
		return "blocked";
	}
}

async function detectTestCommand(pi: ExtensionAPI): Promise<{ command: string; args: string[] }> {
	try {
		const r = await pi.exec("cat", ["package.json"]);
		if (r.code === 0) {
			const pkg = JSON.parse(r.stdout) as { scripts?: Record<string, string> };
			if (pkg.scripts?.test) return { command: "npm", args: ["test", "--silent"] };
		}
	} catch {
		// fall through
	}
	return { command: "bun", args: ["test"] };
}
