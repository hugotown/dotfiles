// ask node (aiAssisted:false): render authored questions in the MAIN UI, await answers.
// No LLM, no tokens, no suspension — it is awaitable (design §9). Uses ctx.ui.input per
// question; a select renders its options inline in the prompt.
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { AskQuestion, NodeResult, NodeState } from "../types.ts";

function promptFor(q: AskQuestion): string {
	if (q.type === "select" && q.options?.length) return `${q.label} [${q.options.join(" / ")}]`;
	return q.label;
}

export async function runAskNode(node: NodeState, ctx: ExtensionContext): Promise<NodeResult> {
	const answers: string[] = [];
	for (const q of node.questions ?? []) {
		const value = (await ctx.ui.input(promptFor(q), q.default ?? "")) ?? q.default ?? "";
		answers.push(`${q.id}: ${value}`);
	}
	return { status: "ok", output: answers.join("\n") };
}
