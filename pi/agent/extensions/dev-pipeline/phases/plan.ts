import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { applyPhaseConfig, artifactIsValid, drivePhase } from "../orchestrator.ts";
import { planAuthorPrompt, planReviewPrompt, researchDecisionPrompt } from "../lib/prompts.ts";
import { specPathFor } from "./spec.ts";
import { artifactPath, dateStamp } from "../lib/paths.ts";
import type { Task, PipelineState } from "../state.ts";

export function researchPathFor(s: PipelineState): string {
	return artifactPath(s.artifactFolder ?? ".", dateStamp(), s.slug ?? "feature", "research");
}
export function planPathFor(s: PipelineState): string {
	return artifactPath(s.artifactFolder ?? ".", dateStamp(), s.slug ?? "feature", "plan");
}

export async function startPlanResearch(pi: ExtensionAPI, ctx: ExtensionContext, s: PipelineState): Promise<void> {
	ctx.ui.setStatus("dev-pipeline", "🔬 plan research");
	if (!(await applyPhaseConfig(pi, ctx, "PLAN_RESEARCH"))) return;
	drivePhase(pi, researchDecisionPrompt(s, specPathFor(s), researchPathFor(s)));
}

/**
 * FR-18: run the requested research deterministically. Missing tool → empty section, never error.
 * Reads the research-decision file, executes rg always, ast-grep/graphify/ctx7 conditionally,
 * and returns a results string to feed the plan author.
 */
export async function runResearch(
	pi: ExtensionAPI,
	s: PipelineState,
	probes: { astGrep: boolean; graphify: boolean },
): Promise<string> {
	let decision = "";
	try {
		const r = await pi.exec("cat", [researchPathFor(s)]);
		decision = r.code === 0 ? r.stdout : "";
	} catch {
		decision = "";
	}

	const patterns = extractList(decision, "PATTERNS");
	const libraries = extractList(decision, "LIBRARIES");
	const sections: string[] = [];

	// rg: always
	for (const pat of patterns) {
		const out = await safe(pi, "rg", ["-n", "--max-count", "20", pat]);
		sections.push(`### rg "${pat}"\n${out || "(no matches)"}`);
	}
	// ast-grep: only if available
	if (probes.astGrep) {
		for (const pat of patterns) {
			const out = await safe(pi, "ast-grep", ["run", "--pattern", pat]);
			if (out) sections.push(`### ast-grep "${pat}"\n${out}`);
		}
	}
	// graphify: only if graphify-out/ exists
	if (probes.graphify) {
		// graphify query wiring is UNVERIFIED (project-local CLI). Intentionally a no-op until the
		// project's graphify query command is confirmed; then run it here and append to `sections`.
	}
	// ctx7: for named libraries
	for (const lib of libraries) {
		const out = await safe(pi, "npx", ["ctx7@latest", "library", lib]);
		sections.push(`### ctx7 ${lib}\n${(out || "(no docs)").slice(0, 1500)}`);
	}

	return sections.join("\n\n") || "(no research results)";
}

export async function startPlanAuthor(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	s: PipelineState,
	researchResults: string,
): Promise<void> {
	ctx.ui.setStatus("dev-pipeline", "✍️ plan author");
	if (!(await applyPhaseConfig(pi, ctx, "PLAN_AUTHOR"))) return;
	drivePhase(pi, planAuthorPrompt(s, specPathFor(s), researchResults, planPathFor(s)));
}

export async function startPlanReview(pi: ExtensionAPI, ctx: ExtensionContext, s: PipelineState): Promise<void> {
	ctx.ui.setStatus("dev-pipeline", "🔎 plan self-review");
	if (!(await applyPhaseConfig(pi, ctx, "PLAN_SELF_REVIEW"))) return;
	drivePhase(pi, planReviewPrompt(specPathFor(s), planPathFor(s)));
}

/** Parse "### Task N: title" headings into the task list (control flow uses files, not LLM JSON). */
export async function readTasks(pi: ExtensionAPI, s: PipelineState): Promise<Task[]> {
	let md = "";
	try {
		const r = await pi.exec("cat", [planPathFor(s)]);
		md = r.code === 0 ? r.stdout : "";
	} catch {
		md = "";
	}
	const tasks: Task[] = [];
	for (const line of md.split("\n")) {
		const m = line.match(/^###\s+Task\s+(\d+):\s*(.+)$/);
		if (m) tasks.push({ id: Number(m[1]), title: m[2].trim(), status: "pending" });
	}
	return tasks;
}

export async function planFileValid(pi: ExtensionAPI, s: PipelineState): Promise<boolean> {
	return artifactIsValid(pi, planPathFor(s));
}

function extractList(text: string, header: string): string[] {
	const lines = text.split("\n");
	const out: string[] = [];
	let inSection = false;
	for (const line of lines) {
		if (new RegExp(`^${header}:`).test(line.trim())) {
			inSection = true;
			continue;
		}
		if (/^[A-Z]+:/.test(line.trim())) inSection = false;
		if (inSection) {
			const item = line.match(/^\s*-\s*(.+)$/);
			if (item) out.push(item[1].trim());
		}
	}
	return out;
}

async function safe(pi: ExtensionAPI, command: string, args: string[]): Promise<string> {
	try {
		const r = await pi.exec(command, args, { timeout: 30000 });
		return r.code === 0 ? r.stdout.trim() : "";
	} catch {
		return "";
	}
}
