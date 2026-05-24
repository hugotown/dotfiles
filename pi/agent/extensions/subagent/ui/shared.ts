// Rendering primitives shared by the call and result views.
import type { Theme } from "@earendil-works/pi-coding-agent";
import type { AgentResult } from "../result.ts";
import type { AgentStatus } from "../types.ts";

export function statusIcon(theme: Theme, status: AgentStatus): string {
	switch (status) {
		case "ok":
			return theme.fg("success", "✓");
		case "failed":
			return theme.fg("error", "✗");
		case "skipped":
			return theme.fg("muted", "⊘");
		case "running":
			return theme.fg("warning", "⏳");
		default:
			return theme.fg("muted", "○");
	}
}

export function modelLabel(r: { provider: string; model: string; variant: string }): string {
	return `${r.provider}/${r.model}:${r.variant}`;
}

export function summaryLine(theme: Theme, results: AgentResult[]): string {
	const count = (s: AgentStatus) => results.filter((r) => r.status === s).length;
	const parts = [`${count("ok")}/${results.length} ok`];
	if (count("failed")) parts.push(theme.fg("error", `${count("failed")} failed`));
	if (count("skipped")) parts.push(theme.fg("muted", `${count("skipped")} skipped`));
	if (count("running")) parts.push(theme.fg("warning", `${count("running")} running`));
	return parts.join(theme.fg("muted", ", "));
}
