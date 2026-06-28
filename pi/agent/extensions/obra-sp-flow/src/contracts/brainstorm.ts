/** Brainstorm round + final contracts (design + discovery). */
import { Type } from "@sinclair/typebox";
import { arr, Base, Bool, loose, Num, opt, S } from "./base.ts";
import { AsIs, DiscoveryApplicability, Sipoc, Understanding, UserJourney, UserStory } from "./discovery.ts";

export const Design = loose({
	title: S,
	approaches: opt(arr(loose({ id: S, name: S, summary: S, tradeoffs: opt(arr(S)), recommended: opt(Bool) }))),
	recommendation: opt(loose({ approachId: S, reason: S })),
	sections: opt(loose({ architecture: opt(S), components: opt(S), dataFlow: opt(S), errorHandling: opt(S), testing: opt(S) })),
	specMarkdown: S,
});

const Question = loose({
	id: S,
	question: S,
	why: opt(S),
	kind: S,
	options: opt(arr(S)),
	recommended: opt(S),
	allowFreeText: Bool,
	visual: opt(Bool),
	asciiWireframe: opt(S),
});

const discovery = {
	understanding: Understanding,
	discoveryApplicability: DiscoveryApplicability,
	userStory: UserStory,
	sipoc: Sipoc,
	userJourney: UserJourney,
	// As-Is of the project (existing files involved + their current state). Optional in
	// the round contract (appears as the picture crystallizes); the harness guarantees it
	// in the final BrainstormContract (greenfield => empty files).
	asIs: opt(AsIs),
};

export const BrainstormRoundContract = loose({
	...Base,
	round: Num,
	reasoning: opt(S),
	...discovery,
	design: opt(Design),
	status: Type.Union([Type.Literal("needs-answers"), Type.Literal("ready")]),
	questions: arr(Question),
});

export const BrainstormContract = loose({
	...Base,
	rounds: Num,
	terminatedBy: S,
	...discovery,
	design: opt(Design),
	qaHistory: arr(Type.Object({ round: Num, questionId: S, question: S, answer: S })),
});
