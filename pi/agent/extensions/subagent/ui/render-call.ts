// Tool-call view: a compact overview of the agents and their dependency edges.
import type { Theme } from "@earendil-works/pi-coding-agent";
import { type Component, Text } from "@earendil-works/pi-tui";
import type { AgentSpec } from "../types.ts";
import { modelLabel } from "./shared.ts";

export function renderCall(args: { agents?: AgentSpec[] }, theme: Theme): Component {
	const agents = args.agents ?? [];
	let text =
		theme.fg("toolTitle", theme.bold("subagent ")) +
		theme.fg("accent", `${agents.length} agent${agents.length === 1 ? "" : "s"}`);
	for (const a of agents.slice(0, 6)) {
		const deps = (a.dependsOn ?? []).length ? theme.fg("dim", ` ⟵ ${(a.dependsOn ?? []).join(", ")}`) : "";
		text += `\n  ${theme.fg("accent", a.name)}${theme.fg("muted", ` ${modelLabel(a)}`)}${deps}`;
	}
	if (agents.length > 6) text += `\n  ${theme.fg("muted", `... +${agents.length - 6} more`)}`;
	return new Text(text, 0, 0);
}
