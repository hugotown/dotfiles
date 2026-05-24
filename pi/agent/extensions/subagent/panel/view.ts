// Master-detail panel: left list of agents, right streaming log of the selected one,
// rendered opaque using colors from config (Tokyo Night by default). Navigation keys
// come from the keymap; the detail auto-follows selection.
import { type Component, type KeyId, matchesKey } from "@earendil-works/pi-tui";
import type { KeymapConfig } from "../lib/keymap.ts";
import type { ThemeColors } from "../lib/theme.ts";
import type { AgentResult } from "../result.ts";
import { detailLines } from "./detail-render.ts";
import { joinColumns } from "./layout.ts";
import { listLines } from "./list-render.ts";
import { bg, bold, fg, pad } from "./palette.ts";

const GAP = " │ ";

export class SubagentPanel implements Component {
	private run: AgentResult[] = [];
	private selected = 0;

	constructor(
		private readonly keymap: KeymapConfig,
		private readonly theme: ThemeColors,
		private readonly onClose: () => void,
		private readonly onChange: () => void,
	) {}

	setRun(run: AgentResult[]): void {
		this.run = run;
		if (this.selected >= run.length) this.selected = Math.max(0, run.length - 1);
	}

	private hits(data: string, ids: string[]): boolean {
		return ids.some((id) => matchesKey(data, id as KeyId));
	}

	handleInput(data: string): void {
		const { up, down, close } = this.keymap.nav;
		if (this.hits(data, close)) return this.onClose();
		if (this.hits(data, up)) this.selected = Math.max(0, this.selected - 1);
		else if (this.hits(data, down)) this.selected = Math.min(this.run.length - 1, this.selected + 1);
		else return;
		this.onChange();
	}

	invalidate(): void {}

	render(width: number): string[] {
		const t = this.theme;
		const height = Math.max(6, Math.floor((process.stdout.rows ?? 24) * 0.75));
		const leftWidth = Math.min(26, Math.floor(width * 0.35));
		const detailWidth = Math.max(1, width - leftWidth - GAP.length);
		const left = listLines(this.run, this.selected, t, leftWidth, height);
		const right = detailLines(this.run[this.selected], t, detailWidth, height);
		const gap = bg(t.panelBg, fg(t.dim, GAP));
		const title = bg(t.selectedBg, bold(fg(t.blue, pad(` Subagents (${this.run.length})`, width))));
		return [title, ...joinColumns(left, right, height, leftWidth, gap)];
	}
}
