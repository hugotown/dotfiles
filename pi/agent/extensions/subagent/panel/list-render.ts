// Left column: one opaque line per agent (cursor + status marker + name), windowed to
// `height` rows. Built on plain text padded to width, then colored over a solid bg.
import type { ThemeColors } from "../lib/theme.ts";
import type { AgentResult } from "../result.ts";
import type { AgentStatus } from "../types.ts";
import { bg, fg, pad } from "./palette.ts";

const MARK: Record<AgentStatus, [string, keyof ThemeColors]> = {
	running: ["*", "yellow"],
	ok: ["+", "green"],
	failed: ["x", "red"],
	skipped: ["-", "dim"],
	pending: [".", "muted"],
};

function windowStart(selected: number, count: number, height: number): number {
	return Math.max(0, Math.min(selected - Math.floor(height / 2), Math.max(0, count - height)));
}

export function listLines(run: AgentResult[], selected: number, theme: ThemeColors, width: number, height: number): string[] {
	const start = windowStart(selected, run.length, height);
	const lines: string[] = [];
	for (let i = 0; i < height; i++) {
		const idx = start + i;
		const agent = run[idx];
		const rowBg = idx === selected ? theme.selectedBg : theme.panelBg;
		if (!agent) {
			lines.push(bg(rowBg, " ".repeat(width)));
			continue;
		}
		const [mark, markKey] = MARK[agent.status];
		const label = pad(`${idx === selected ? ">" : " "} ${mark} ${agent.name}`, width);
		const base = idx === selected ? theme.fg : theme.muted;
		lines.push(bg(rowBg, fg(base, label.slice(0, 2)) + fg(theme[markKey], label.slice(2, 3)) + fg(base, label.slice(3))));
	}
	return lines;
}
