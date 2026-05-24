// result.ts — pure text-formatting for tool results; no TUI dependency
import type { BaseQuestion, Answer } from "./types.ts";
import { getType } from "./registry.ts";

export type ToolOutcome =
	| { kind: "answers"; answers: { question: string; answer: string }[]; comments: string; note?: string }
	| { kind: "cancelled" };

export function buildToolText(o: ToolOutcome): string {
	if (o.kind === "cancelled") return "The user cancelled the question form. Do not retry; ask how they want to proceed.";
	const lines = o.answers.map((a) => `- ${a.question} => ${a.answer || "(no answer)"}`);
	const parts = [o.note ?? "The user answered the form:", lines.join("\n")];
	if (o.comments.trim()) parts.push(`\nUser comments:\n${o.comments.trim()}`);
	return parts.join("\n");
}

/** Format each question's answer via its registered type's toText. Falls back to comma-join. */
export function formatAnswer(q: BaseQuestion, ans: Answer): string {
	const handler = getType(q.type);
	if (handler) return handler.toText(q, ans);
	return Array.isArray(ans) ? ans.join(", ") : (ans ?? "");
}
