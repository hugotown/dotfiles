// DaddyPanel: master-detail overlay. Run mode shows the live status tree; design mode
// (Task 26) shows the editable tree + detail form. Mode toggles with Tab.
import { type Component, type KeyId, matchesKey } from "@earendil-works/pi-tui";
import type { StateMachine } from "../types.ts";
import { renderRun } from "./run-render.ts";

export class DaddyPanel implements Component {
	private run: StateMachine | null = null;
	private selected = 0;

	constructor(private readonly onClose: () => void, private readonly onChange: () => void) {}

	setRun(run: StateMachine | null): void {
		this.run = run;
	}

	handleInput(data: string): void {
		if (matchesKey(data, "escape" as KeyId) || matchesKey(data, "q" as KeyId)) return this.onClose();
		if (matchesKey(data, "down" as KeyId) || matchesKey(data, "j" as KeyId)) this.selected++;
		else if (matchesKey(data, "up" as KeyId) || matchesKey(data, "k" as KeyId)) this.selected = Math.max(0, this.selected - 1);
		else return;
		this.onChange();
	}

	invalidate(): void {}

	render(width: number): string[] {
		return renderRun(this.run, this.selected, width);
	}
}
