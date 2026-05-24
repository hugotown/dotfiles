export type Phase =
	| "IDLE"
	| "GATHERING_CONTEXT"
	| "BRAINSTORM"
	| "SPEC"
	| "SPEC_SELF_REVIEW"
	| "SPEC_GATE"
	| "PLAN_RESEARCH"
	| "PLAN_AUTHOR"
	| "PLAN_SELF_REVIEW"
	| "PLAN_GATE"
	| "IMPLEMENT"
	| "REVIEW"
	| "NOTES"
	| "COMPLETE"
	| "BLOCKED";

export interface Task {
	id: number;
	title: string;
	status: "pending" | "done" | "blocked";
}

export interface PipelineState {
	phase: Phase;
	activity: string;
	artifactFolder: string | null;
	slug: string | null;
	compressedContext: string;
	decisions: string;
	questionRound: number;
	specPath: string | null;
	planPath: string | null;
	tasks: Task[];
	currentTaskIndex: number;
	reviewVerdict: "APPROVED" | "CHANGES_REQUIRED" | null;
	notesPath: string | null;
	originalModel: { provider: string; id: string } | null;
	allToolNames: string[];
	gateAttempts: number;
	gateFeedback: string;
}

export type PipelineEvent =
	| { type: "START" }
	| { type: "CONTEXT_READY"; compressedContext: string; artifactFolder: string }
	| { type: "QUESTION_ROUND" }
	| { type: "PROCEED"; decisions: string; slug: string }
	| { type: "SPEC_WRITTEN"; specPath: string }
	| { type: "REVIEWED" }
	| { type: "APPROVED" }
	| { type: "REJECT"; feedback: string }
	| { type: "RESEARCH_DECIDED" }
	| { type: "PLAN_WRITTEN"; planPath: string; tasks: Task[] }
	| { type: "TASK_DONE" }
	| { type: "ALL_TASKS_DONE" }
	| { type: "BLOCKED" }
	| { type: "REVIEWED_CODE"; verdict: "APPROVED" | "CHANGES_REQUIRED" }
	| { type: "NOTES_WRITTEN"; notesPath: string }
	| { type: "RESET" };

export function createInitialState(activity: string): PipelineState {
	return {
		phase: "IDLE",
		activity,
		artifactFolder: null,
		slug: null,
		compressedContext: "",
		decisions: "",
		questionRound: 0,
		specPath: null,
		planPath: null,
		tasks: [],
		currentTaskIndex: 0,
		reviewVerdict: null,
		notesPath: null,
		originalModel: null,
		allToolNames: [],
		gateAttempts: 0,
		gateFeedback: "",
	};
}

/**
 * Pure reducer. Every transition is guarded by the current phase; an event that
 * does not match the phase returns the state unchanged (0 LLM tokens, FR-2/NFR-1).
 * RESET is honored from any phase.
 */
export function transition(state: PipelineState, event: PipelineEvent): PipelineState {
	if (event.type === "RESET") {
		return { ...state, phase: "IDLE" };
	}

	switch (state.phase) {
		case "IDLE":
			if (event.type === "START") return { ...state, phase: "GATHERING_CONTEXT" };
			return state;

		case "GATHERING_CONTEXT":
			if (event.type === "CONTEXT_READY")
				return {
					...state,
					phase: "BRAINSTORM",
					compressedContext: event.compressedContext,
					artifactFolder: event.artifactFolder,
				};
			return state;

		case "BRAINSTORM":
			if (event.type === "QUESTION_ROUND") return { ...state, questionRound: state.questionRound + 1 };
			if (event.type === "PROCEED")
				return { ...state, phase: "SPEC", decisions: event.decisions, slug: event.slug };
			return state;

		case "SPEC":
			if (event.type === "SPEC_WRITTEN")
				return { ...state, phase: "SPEC_SELF_REVIEW", specPath: event.specPath };
			return state;

		case "SPEC_SELF_REVIEW":
			if (event.type === "REVIEWED") return { ...state, phase: "SPEC_GATE" };
			return state;

		case "SPEC_GATE":
			if (event.type === "APPROVED") return { ...state, phase: "PLAN_RESEARCH", gateFeedback: "" };
			if (event.type === "REJECT") return { ...state, phase: "SPEC", gateAttempts: state.gateAttempts + 1, gateFeedback: event.feedback };
			return state;

		case "PLAN_RESEARCH":
			if (event.type === "RESEARCH_DECIDED") return { ...state, phase: "PLAN_AUTHOR" };
			return state;

		case "PLAN_AUTHOR":
			if (event.type === "PLAN_WRITTEN")
				return { ...state, phase: "PLAN_SELF_REVIEW", planPath: event.planPath, tasks: event.tasks };
			return state;

		case "PLAN_SELF_REVIEW":
			if (event.type === "REVIEWED") return { ...state, phase: "PLAN_GATE" };
			return state;

		case "PLAN_GATE":
			if (event.type === "APPROVED") return { ...state, phase: "IMPLEMENT", currentTaskIndex: 0, gateFeedback: "" };
			if (event.type === "REJECT")
				return { ...state, phase: "PLAN_AUTHOR", gateAttempts: state.gateAttempts + 1, gateFeedback: event.feedback };
			return state;

		case "IMPLEMENT":
			if (event.type === "TASK_DONE") {
				const tasks = state.tasks.map((t, i) =>
					i === state.currentTaskIndex ? { ...t, status: "done" as const } : t,
				);
				return { ...state, tasks, currentTaskIndex: state.currentTaskIndex + 1 };
			}
			if (event.type === "BLOCKED") {
				const tasks = state.tasks.map((t, i) =>
					i === state.currentTaskIndex ? { ...t, status: "blocked" as const } : t,
				);
				return { ...state, phase: "BLOCKED", tasks };
			}
			if (event.type === "ALL_TASKS_DONE") return { ...state, phase: "REVIEW" };
			return state;

		case "REVIEW":
			if (event.type === "REVIEWED_CODE")
				return { ...state, phase: "NOTES", reviewVerdict: event.verdict };
			return state;

		case "NOTES":
			if (event.type === "NOTES_WRITTEN")
				return { ...state, phase: "COMPLETE", notesPath: event.notesPath };
			return state;

		default:
			return state;
	}
}
