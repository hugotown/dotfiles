// Right column: the selected agent's streaming log (header + tool calls + text), tailed
// to the newest `height` lines. Every line is padded to width and drawn over a solid bg.
import type { ThemeColors } from "../lib/theme.ts";
import type { AgentResult } from "../result.ts";
import { bg, fg, pad } from "./palette.ts";

interface Line {
	text: string;
	hex: string;
}

function rawLines(agent: AgentResult, theme: ThemeColors): Line[] {
	const out: Line[] = [
		{ text: `${agent.name}  ${agent.provider}/${agent.model}:${agent.variant}  [${agent.status}]`, hex: theme.blue },
	];
	if (agent.skippedReason) out.push({ text: `skipped: ${agent.skippedReason}`, hex: theme.dim });
	if (agent.errorMessage) out.push({ text: `error: ${agent.errorMessage}`, hex: theme.red });
	for (const msg of agent.messages) {
		for (const part of msg.content) {
			if (part.type === "toolCall") out.push({ text: `→ ${(part as { name: string }).name}`, hex: theme.muted });
			else if (part.type === "text")
				for (const line of (part as { text: string }).text.split("\n")) out.push({ text: line, hex: theme.fg });
		}
	}
	if (agent.messages.length === 0 && agent.output.trim())
		for (const line of agent.output.split("\n")) out.push({ text: line, hex: theme.fg });
	return out;
}

export function detailLines(agent: AgentResult | undefined, theme: ThemeColors, width: number, height: number): string[] {
	const blank = bg(theme.panelBg, " ".repeat(width));
	if (!agent) return Array.from({ length: height }, () => blank);
	const tail = rawLines(agent, theme).slice(-height);
	const lines = tail.map((l) => bg(theme.panelBg, fg(l.hex, pad(l.text, width))));
	while (lines.length < height) lines.push(blank);
	return lines;
}
