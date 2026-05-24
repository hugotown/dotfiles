import { expect, test } from "bun:test";
import { createInitialState, transition, type PipelineState } from "../state.ts";

function start(): PipelineState {
	return createInitialState("add dark mode");
}

test("createInitialState begins IDLE with the activity", () => {
	const s = start();
	expect(s.phase).toBe("IDLE");
	expect(s.activity).toBe("add dark mode");
	expect(s.questionRound).toBe(0);
	expect(s.gateAttempts).toBe(0);
});

test("START moves IDLE -> GATHERING_CONTEXT", () => {
	const s = transition(start(), { type: "START" });
	expect(s.phase).toBe("GATHERING_CONTEXT");
});

test("CONTEXT_READY stores context and moves to BRAINSTORM", () => {
	let s = transition(start(), { type: "START" });
	s = transition(s, { type: "CONTEXT_READY", compressedContext: "ctx", artifactFolder: "/f" });
	expect(s.phase).toBe("BRAINSTORM");
	expect(s.compressedContext).toBe("ctx");
	expect(s.artifactFolder).toBe("/f");
});

test("out-of-order events return state unchanged", () => {
	const s = start(); // IDLE
	const after = transition(s, { type: "CONTEXT_READY", compressedContext: "x", artifactFolder: "/f" });
	expect(after).toEqual(s);
});

test("brainstorm round increments and PROCEED advances to SPEC", () => {
	let s = transition(transition(start(), { type: "START" }), {
		type: "CONTEXT_READY",
		compressedContext: "c",
		artifactFolder: "/f",
	});
	s = transition(s, { type: "QUESTION_ROUND" });
	expect(s.questionRound).toBe(1);
	s = transition(s, { type: "PROCEED", decisions: "agreed", slug: "dark-mode" });
	expect(s.phase).toBe("SPEC");
	expect(s.decisions).toBe("agreed");
	expect(s.slug).toBe("dark-mode");
});

test("spec write -> self review -> gate -> approve advances to PLAN_RESEARCH", () => {
	let s = bringTo(start(), "SPEC");
	s = transition(s, { type: "SPEC_WRITTEN", specPath: "/f/d.md" });
	expect(s.phase).toBe("SPEC_SELF_REVIEW");
	expect(s.specPath).toBe("/f/d.md");
	s = transition(s, { type: "REVIEWED" });
	expect(s.phase).toBe("SPEC_GATE");
	s = transition(s, { type: "APPROVED" });
	expect(s.phase).toBe("PLAN_RESEARCH");
});

test("spec gate reject bumps attempts and returns to SPEC", () => {
	let s = bringTo(start(), "SPEC_GATE");
	s = transition(s, { type: "REJECT", feedback: "too vague" });
	expect(s.phase).toBe("SPEC");
	expect(s.gateAttempts).toBe(1);
});

test("plan flow research -> author -> review -> gate -> approve -> IMPLEMENT", () => {
	let s = bringTo(start(), "PLAN_RESEARCH");
	s = transition(s, { type: "RESEARCH_DECIDED" });
	expect(s.phase).toBe("PLAN_AUTHOR");
	s = transition(s, { type: "PLAN_WRITTEN", planPath: "/f/p.md", tasks: [{ id: 1, title: "t1", status: "pending" }] });
	expect(s.phase).toBe("PLAN_SELF_REVIEW");
	expect(s.tasks.length).toBe(1);
	s = transition(s, { type: "REVIEWED" });
	expect(s.phase).toBe("PLAN_GATE");
	s = transition(s, { type: "APPROVED" });
	expect(s.phase).toBe("IMPLEMENT");
});

test("implement task done advances index; ALL_TASKS_DONE -> REVIEW", () => {
	let s = bringTo(start(), "IMPLEMENT");
	s.tasks = [
		{ id: 1, title: "a", status: "pending" },
		{ id: 2, title: "b", status: "pending" },
	];
	s = transition(s, { type: "TASK_DONE" });
	expect(s.tasks[0].status).toBe("done");
	expect(s.currentTaskIndex).toBe(1);
	expect(s.phase).toBe("IMPLEMENT");
	s = transition(s, { type: "TASK_DONE" });
	expect(s.tasks[1].status).toBe("done");
	s = transition(s, { type: "ALL_TASKS_DONE" });
	expect(s.phase).toBe("REVIEW");
});

test("BLOCKED from IMPLEMENT marks the task and halts", () => {
	let s = bringTo(start(), "IMPLEMENT");
	s.tasks = [{ id: 1, title: "a", status: "pending" }];
	s = transition(s, { type: "BLOCKED" });
	expect(s.phase).toBe("BLOCKED");
	expect(s.tasks[0].status).toBe("blocked");
});

test("REVIEW -> NOTES -> COMPLETE", () => {
	let s = bringTo(start(), "REVIEW");
	s = transition(s, { type: "REVIEWED_CODE", verdict: "APPROVED" });
	expect(s.phase).toBe("NOTES");
	expect(s.reviewVerdict).toBe("APPROVED");
	s = transition(s, { type: "NOTES_WRITTEN", notesPath: "/f/i.md" });
	expect(s.phase).toBe("COMPLETE");
	expect(s.notesPath).toBe("/f/i.md");
});

test("RESET returns to IDLE from any phase", () => {
	const s = transition(bringTo(start(), "IMPLEMENT"), { type: "RESET" });
	expect(s.phase).toBe("IDLE");
});

// Helper: drive the machine through the happy path up to a target phase.
function bringTo(s: PipelineState, target: PipelineState["phase"]): PipelineState {
	const steps: { ev: Parameters<typeof transition>[1]; reach: PipelineState["phase"] }[] = [
		{ ev: { type: "START" }, reach: "GATHERING_CONTEXT" },
		{ ev: { type: "CONTEXT_READY", compressedContext: "c", artifactFolder: "/f" }, reach: "BRAINSTORM" },
		{ ev: { type: "PROCEED", decisions: "d", slug: "s" }, reach: "SPEC" },
		{ ev: { type: "SPEC_WRITTEN", specPath: "/f/d.md" }, reach: "SPEC_SELF_REVIEW" },
		{ ev: { type: "REVIEWED" }, reach: "SPEC_GATE" },
		{ ev: { type: "APPROVED" }, reach: "PLAN_RESEARCH" },
		{ ev: { type: "RESEARCH_DECIDED" }, reach: "PLAN_AUTHOR" },
		{ ev: { type: "PLAN_WRITTEN", planPath: "/f/p.md", tasks: [{ id: 1, title: "t", status: "pending" }] }, reach: "PLAN_SELF_REVIEW" },
		{ ev: { type: "REVIEWED" }, reach: "PLAN_GATE" },
		{ ev: { type: "APPROVED" }, reach: "IMPLEMENT" },
		{ ev: { type: "ALL_TASKS_DONE" }, reach: "REVIEW" },
	];
	let cur = s;
	for (const step of steps) {
		cur = transition(cur, step.ev);
		if (cur.phase === target) return cur;
	}
	return cur;
}
