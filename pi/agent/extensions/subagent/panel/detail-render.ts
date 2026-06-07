// Right column: the selected agent's streaming log (header + tool calls + text), tailed
// to the newest `height` lines. Every line is wrapped to `width` (not truncated) and drawn
// over a solid bg. The streaming tool output is appended at the end so bash/read progress
// is visible while the agent is still working.
import type { ThemeColors } from "../lib/theme.ts";
import type { AgentResult } from "../result.ts";
import { bg, fg, pad, wordWrap } from "./palette.ts";

interface Line {
	text: string;
	hex: string;
}

function pushWrapped(out: Line[], text: string, hex: string, width: number): void {
	for (const line of wordWrap(text, width)) out.push({ text: line, hex });
}

function rawLines(agent: AgentResult, theme: ThemeColors, width: number): Line[] {
	const out: Line[] = [];
	pushWrapped(out, `${agent.name}  ${agent.provider}/${agent.model}:${agent.variant}  [${agent.status}]`, theme.blue, width);
	if (agent.skippedReason) pushWrapped(out, `skipped: ${agent.skippedReason}`, theme.dim, width);
	if (agent.errorMessage) pushWrapped(out, `error: ${agent.errorMessage}`, theme.red, width);
	for (const msg of agent.messages) {
		for (const part of msg.content) {
			if (part.type === "toolCall") pushWrapped(out, `→ ${(part as { name: string }).name}`, theme.muted, width);
			else if (part.type === "text") pushWrapped(out, (part as { text: string }).text, theme.fg, width);
		}
	}
	if (agent.messages.length === 0 && agent.output.trim()) pushWrapped(out, agent.output, theme.fg, width);

	// Live streaming tool output: every running tool's current partial buffer is appended
	// at the end of the log so the user sees progress (bash lines appearing, etc.) before
	// the corresponding tool_execution_end replaces the entry with the final result.
	for (const [id, output] of agent.toolOutputs) {
		pushWrapped(out, `[${id}]`, theme.dim, width);
		if (output) pushWrapped(out, output, theme.muted, width);
	}
	return out;
}

export function detailLines(agent: AgentResult | undefined, theme: ThemeColors, width: number, height: number): string[] {
	const blank = bg(theme.panelBg, " ".repeat(width));
	if (!agent) return Array.from({ length: height }, () => blank);
	const tail = rawLines(agent, theme, width).slice(-height);
	const lines = tail.map((l) => bg(theme.panelBg, fg(l.hex, pad(l.text, width))));
	while (lines.length < height) lines.push(blank);
	return lines;
}
