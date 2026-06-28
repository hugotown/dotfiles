/** Product-discovery contracts (parity with forge): user story / SIPOC / journey. */
import { Type } from "@sinclair/typebox";
import { arr, Bool, loose, Num, opt, S } from "./base.ts";

export const Understanding = Type.Object({
	objective: S,
	problemStatement: S,
	successCriteria: arr(S),
	nonGoals: arr(S),
	assumptions: arr(S),
	openUnknowns: arr(S),
});

const Gherkin = Type.Object({ scenario: S, given: arr(S), when: arr(S), then: arr(S) });

export const UserStory = Type.Union([
	Type.Literal(false),
	loose({
		title: S,
		narrative: Type.Object({ asA: S, iWant: S, soThat: S }),
		businessRules: arr(S),
		acceptanceCriteria: arr(Gherkin),
		definitionOfDone: arr(S),
		uxUiAndData: Type.Object({ notes: arr(S), links: arr(S), apiContracts: arr(S) }),
		complete: Bool,
		missing: arr(S),
	}),
]);

export const Sipoc = Type.Union([
	Type.Literal(false),
	loose({
		suppliers: arr(S), inputs: arr(S), process: arr(S), outputs: arr(S), customers: arr(S),
		boundaries: arr(S), assumptions: arr(S), complete: Bool, missing: arr(S),
	}),
]);

const JourneyStep = Type.Object({ n: Num, action: S, touchpoint: S, systemResponse: S, dataOrRule: S });

export const UserJourney = Type.Union([
	Type.Literal(false),
	loose({
		actors: arr(S),
		journeys: arr(loose({ name: S, persona: S, goal: S, steps: arr(JourneyStep) })),
		painPoints: arr(S), successMetrics: arr(S), complete: Bool, missing: arr(S),
	}),
]);

/**
 * As-Is — the design-phase snapshot of the existing code involved in the requirement:
 * which files participate and what state they are in TODAY (purely descriptive). The
 * To-Be (target files/changes) is the plan phase's job, not this one. The brainstorm
 * consolidates it from the `context-extract` grounding; `write-spec` renders it into
 * design.md. Greenfield => `files: []` + a `summary` saying so.
 */
export const AsIs = loose({
	summary: S,
	files: arr(loose({ path: S, role: S, currentState: S })),
	notes: opt(arr(S)),
});

export const DiscoveryApplicability = Type.Object({
	userStory: Type.Object({ applies: Bool, reason: S }),
	sipoc: Type.Object({ applies: Bool, reason: S }),
	userJourney: Type.Object({ applies: Bool, reason: S }),
});
