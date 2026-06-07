// Tool-result view: per-agent status with output. Collapsed by default; full on expand.
import type { AgentToolResult, Theme } from "@earendil-works/pi-coding-agent";
import { getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import { type Component, Container, Markdown, Spacer, Text } from "@earendil-works/pi-tui";
import type { AgentResult, SubagentDetails } from "../result.ts";
import { aggregateUsage, formatUsage } from "../lib/format.ts";
import { modelLabel, statusIcon, summaryLine } from "./shared.ts";

function collapsed(theme: Theme, header: string, results: AgentResult[]): Component {
	let text = header;
	for (const r of results) {
		const note = r.skippedReason ? theme.fg("dim", ` — ${r.skippedReason}`) : "";
		text += `\n  ${statusIcon(theme, r.status)} ${theme.fg("accent", r.name)}${theme.fg("muted", ` ${modelLabel(r)}`)}${note}`;
		// Only show output preview when the agent has finished; live streaming is visible in the panel.
		if (r.status === "ok" || r.status === "failed") {
			const preview = r.output.trim().split("\n").slice(0, 2).join("\n");
			if (preview) text += `\n    ${theme.fg("toolOutput", preview)}`;
		}
	}
	return new Text(`${text}\n${theme.fg("muted", "(Ctrl+O to expand)")}`, 0, 0);
}

function expandedAgent(container: Container, theme: Theme, r: AgentResult): void {
	container.addChild(new Spacer(1));
	container.addChild(new Text(`${statusIcon(theme, r.status)} ${theme.fg("toolTitle", theme.bold(r.name))}${theme.fg("muted", ` ${modelLabel(r)}`)}`, 0, 0));
	if (r.skippedReason) return container.addChild(new Text(theme.fg("muted", `Skipped: ${r.skippedReason}`), 0, 0));
	if (r.errorMessage) container.addChild(new Text(theme.fg("error", `Error: ${r.errorMessage}`), 0, 0));
	// Only show output when the agent has finished; live streaming is visible in the panel.
	if (r.status === "ok" || r.status === "failed") {
		if (r.output.trim()) container.addChild(new Markdown(r.output.trim(), 0, 0, getMarkdownTheme()));
		else container.addChild(new Text(theme.fg("muted", "(no output)"), 0, 0));
	} else if (r.status === "running") {
		container.addChild(new Text(theme.fg("muted", "(streaming in panel — press ← to view)"), 0, 0));
	}
	const usage = formatUsage(r.usage);
	if (usage) container.addChild(new Text(theme.fg("dim", usage), 0, 0));
}

export function renderResult(result: AgentToolResult<SubagentDetails>, options: { expanded: boolean }, theme: Theme): Component {
	const results = result.details?.results ?? [];
	if (results.length === 0) {
		const first = result.content[0];
		return new Text(first?.type === "text" ? first.text : "(no output)", 0, 0);
	}
	const header = `${theme.fg("toolTitle", theme.bold("subagent "))}${summaryLine(theme, results)}`;
	if (!options.expanded) return collapsed(theme, header, results);

	const container = new Container();
	container.addChild(new Text(header, 0, 0));
	for (const r of results) expandedAgent(container, theme, r);
	const total = formatUsage(aggregateUsage(results));
	if (total) {
		container.addChild(new Spacer(1));
		container.addChild(new Text(theme.fg("dim", `Total: ${total}`), 0, 0));
	}
	return container;
}
