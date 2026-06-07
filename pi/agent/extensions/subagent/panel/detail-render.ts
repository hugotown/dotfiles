// Right column: the selected agent's streaming log (header + tool calls + text), tailed
// to the newest `height` lines. Every line is wrapped to the available content width
// (not truncated) and drawn over a solid bg with left/right padding. The streaming tool
// output is appended at the end so bash/read progress is visible while the agent is
// still working.
import type { ThemeColors } from "../lib/theme.ts";
import type { AgentResult } from "../result.ts";
import { bg, fg, wordWrap } from "./palette.ts";

/** Padding in columns on each side of the detail pane. */
const PADDING = 1;
const PAD_STR = " ".repeat(PADDING);

interface Line {
	text: string;
	hex: string;
}

function pushWrapped(out: Line[], text: string, hex: string, contentWidth: number): void {
	for (const line of wordWrap(text, contentWidth)) out.push({ text: line, hex });
}

function rawLines(agent: AgentResult, theme: ThemeColors, contentWidth: number): Line[] {
	const out: Line[] = [];
	pushWrapped(out, `${agent.name}  ${agent.provider}/${agent.model}:${agent.variant}  [${agent.status}]`, theme.blue, contentWidth);
	if (agent.skippedReason) pushWrapped(out, `skipped: ${agent.skippedReason}`, theme.dim, contentWidth);
	if (agent.errorMessage) pushWrapped(out, `error: ${agent.errorMessage}`, theme.red, contentWidth);
	for (const msg of agent.messages) {
		for (const part of msg.content) {
			if (part.type === "toolCall") pushWrapped(out, `→ ${(part as { name: string }).name}`, theme.muted, contentWidth);
			else if (part.type === "text") pushWrapped(out, (part as { text: string }).text, theme.fg, contentWidth);
		}
	}
	if (agent.messages.length === 0 && agent.output.trim()) pushWrapped(out, agent.output, theme.fg, contentWidth);

	// Live streaming tool output: every running tool's current partial buffer is appended
	// at the end of the log so the user sees progress (bash lines appearing, etc.) before
	// the corresponding tool_execution_end replaces the entry with the final result.
	for (const [id, output] of agent.toolOutputs) {
		pushWrapped(out, `[${id}]`, theme.dim, contentWidth);
		if (output) pushWrapped(out, output, theme.muted, contentWidth);
	}
	return out;
}

/** Pad a plain-text line to exactly `contentWidth` without truncating. */
function padLine(text: string, contentWidth: number): string {
	if (text.length >= contentWidth) return text.slice(0, contentWidth);
	return text + " ".repeat(contentWidth - text.length);
}

/** Center text within `width`, padding with spaces on both sides. */
function centerText(text: string, width: number): string {
	if (text.length >= width) return text.slice(0, width);
	const left = Math.floor((width - text.length) / 2);
	const right = width - text.length - left;
	return " ".repeat(left) + text + " ".repeat(right);
}

/** Bottom status indicator: shows progress while running, or finality when done. */
function statusIndicator(agent: AgentResult, theme: ThemeColors, contentWidth: number): string {
	let text: string;
	let hex: string;
	if (agent.status === "running" || agent.status === "pending") {
		text = "--- loading ---";
		hex = theme.yellow;
	} else {
		text = "--- FIN ---";
		hex = theme.green;
	}
	return centerText(text, contentWidth);
}

export function detailLines(agent: AgentResult | undefined, theme: ThemeColors, width: number, height: number): string[] {
	const contentWidth = Math.max(1, width - PADDING * 2);
	const blank = bg(theme.panelBg, PAD_STR + " ".repeat(contentWidth) + PAD_STR);
	if (!agent) return Array.from({ length: height }, () => blank);
	// Reserve 1 line at the bottom for the status indicator; show content in the rest.
	const contentHeight = Math.max(1, height - 1);
	const tail = rawLines(agent, theme, contentWidth).slice(-contentHeight);
	const lines = tail.map((l) => bg(theme.panelBg, PAD_STR + fg(l.hex, padLine(l.text, contentWidth)) + PAD_STR));
	while (lines.length < contentHeight) lines.push(blank);
	// Append the status indicator as the last line.
	const indicator = statusIndicator(agent, theme, contentWidth);
	lines.push(bg(theme.panelBg, PAD_STR + fg(agent.status === "running" || agent.status === "pending" ? theme.yellow : theme.green, indicator) + PAD_STR));
	return lines;
}
