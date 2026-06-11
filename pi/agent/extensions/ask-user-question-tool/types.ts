// types.ts — shared contracts for the question-type registry
import type { TSchema } from "typebox";
import type { Editor, TUI } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";

export interface Assumption {
	id: string;
	text: string;
	confidence: "high" | "medium" | "low";
}

/** A question from the LLM; type-specific fields live alongside the base. */
export interface BaseQuestion {
	id: string;
	type: string;
	label: string;
	/** What/why/how/when/where around the question + the flow of what must be decided. */
	context: string;
	/** Rationale explaining why the pre-selected recommendation is recommended. */
	reasoning: string;
	[key: string]: unknown;
}

export type Answer = string | string[];

export interface QuestionsFormResult {
	answers: Record<string, Answer>;
	comments: string;
	cancelled: boolean;
}

/** Services the form gives each sub-view, so handlers stay free of UI wiring. */
export interface SubViewCtx {
	tui: TUI;
	theme: Theme;
	makeEditor(): Editor;
	refresh(): void;
}

/** An open interactive sub-view for answering ONE question. */
export interface SubView {
	render(width: number): string[];
	handleInput(data: string): void;
}

/** A pluggable question type — register one per answer modality. */
export interface AnswerType {
	readonly type: string;
	/** Extra TypeBox fields for this type, merged onto the base question object. */
	readonly fields: Record<string, TSchema>;
	initial(q: BaseQuestion): Answer;
	display(q: BaseQuestion, answer: Answer, theme: Theme): string;
	open(c: SubViewCtx, q: BaseQuestion, current: Answer, done: (a: Answer) => void, cancel: () => void): SubView;
	toText(q: BaseQuestion, answer: Answer): string;
}
