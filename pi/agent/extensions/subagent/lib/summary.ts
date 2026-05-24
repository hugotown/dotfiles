// Builds the model-visible text result: one capped section per agent.
import type { AgentResult } from "../result.ts";

const PER_AGENT_OUTPUT_CAP = 50 * 1024;

export function capOutput(text: string): string {
	if (Buffer.byteLength(text, "utf8") <= PER_AGENT_OUTPUT_CAP) return text;
	let cut = text.slice(0, PER_AGENT_OUTPUT_CAP);
	while (Buffer.byteLength(cut, "utf8") > PER_AGENT_OUTPUT_CAP) cut = cut.slice(0, -1);
	return `${cut}\n\n[Output truncated; full text in tool details.]`;
}

function resultOutput(r: AgentResult): string {
	if (r.status === "skipped") return `(skipped: ${r.skippedReason ?? "dependency not satisfied"})`;
	if (r.status === "failed") return r.errorMessage || r.stderr.trim() || r.output.trim() || "(no output)";
	return r.output.trim() || "(no output)";
}

/**
 * Terse, authoritative note for the parent. Framed as deterministic with a "relay as-is"
 * directive so the model reports the fact instead of speculating about why it happened
 * (speculation is wasted tokens — the behavior is fixed in code, not an anomaly).
 */
function resultNote(r: AgentResult): string {
	if (r.interceptedBy) {
		const via = r.flagsInPrompt?.length ? `flag ${r.flagsInPrompt.join(" ")} → ` : "";
		return `[${via}extension "${r.interceptedBy}" handled this turn deterministically; model not invoked. Relay output verbatim, no explanation needed.]\n`;
	}
	if (r.flagsInPrompt?.length) {
		return `[prompt contains registered flag(s) ${r.flagsInPrompt.join(" ")}; an extension may intercept before the model runs.]\n`;
	}
	return "";
}

export function buildSummary(results: AgentResult[]): string {
	const ok = results.filter((r) => r.status === "ok").length;
	const sections = results.map(
		(r) => `### [${r.name}] ${r.status} — ${r.provider}/${r.model}:${r.variant}\n\n${resultNote(r)}${capOutput(resultOutput(r))}`,
	);
	return `Subagents: ${ok}/${results.length} succeeded\n\n${sections.join("\n\n---\n\n")}`;
}
