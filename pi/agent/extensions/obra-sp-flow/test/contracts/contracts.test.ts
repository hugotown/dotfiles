import { describe, expect, it } from "bun:test";
import { Type } from "@sinclair/typebox";
import { validateContract } from "../../src/contracts/base.ts";
import { BrainstormContract, BrainstormRoundContract, Design } from "../../src/contracts/brainstorm.ts";
import { AsIs, DiscoveryApplicability, Sipoc, Understanding, UserJourney, UserStory } from "../../src/contracts/discovery.ts";
import { ApprovalGateContract, SpecReviewContract, WriteSpecContract } from "../../src/contracts/finalize.ts";
import { CollectTreeContract, ContextExtractContract, WebGroundingContract } from "../../src/contracts/grounding.ts";

const applicability = {
	userStory: { applies: true, reason: "r" },
	sipoc: { applies: true, reason: "r" },
	userJourney: { applies: false, reason: "r" },
};
const understanding = { objective: "o", problemStatement: "p", successCriteria: [], nonGoals: [], assumptions: [], openUnknowns: [] };

describe("validateContract", () => {
	it("passes a valid payload", () => {
		expect(validateContract(Type.Object({ a: Type.Number() }), { a: 1 }).ok).toBe(true);
	});
	it("reports errors for invalid payload", () => {
		const r = validateContract(Type.Object({ a: Type.Number() }), { a: "x" });
		expect(r.ok).toBe(false);
		expect(r.errors.length).toBeGreaterThan(0);
	});
});

describe("phase contracts accept representative payloads", () => {
	it("collect-tree + context-extract", () => {
		expect(validateContract(CollectTreeContract, { verdict: "pass", blockers: [], tool: "eza", depth: 5, treeText: "t", lines: 1, truncated: false }).ok).toBe(true);
		expect(validateContract(ContextExtractContract, { verdict: "pass", blockers: [], requirement: "r", repoSummary: "s", curatedContext: "# c" }).ok).toBe(true);
	});
	it("web-grounding accepts available + degraded payloads", () => {
		expect(
			validateContract(WebGroundingContract, {
				verdict: "pass", blockers: [], topic: "t", asOfDate: "2026-06-27", webAvailable: true,
				queries: [{ query: "q", backend: "ddg", rationale: "r" }],
				bestPractices: [{ practice: "p", why: "w", sources: ["https://x"] }],
				risks: [{ kind: "business", severity: "high", text: "r" }],
				references: [{ title: "t", url: "https://x" }],
				curatedBriefing: "# brief",
			}).ok,
		).toBe(true);
		expect(validateContract(WebGroundingContract, { verdict: "pass", blockers: [], topic: "t", asOfDate: "2026-06-27", webAvailable: false, curatedBriefing: "(web unavailable)" }).ok).toBe(true);
	});
	it("as-is accepts populated + greenfield", () => {
		expect(validateContract(AsIs, { summary: "s", files: [{ path: "a.ts", role: "core", currentState: "exists" }] }).ok).toBe(true);
		expect(validateContract(AsIs, { summary: "greenfield", files: [] }).ok).toBe(true);
	});
	it("discovery schemas accept false and objects", () => {
		expect(validateContract(UserStory, false).ok).toBe(true);
		expect(validateContract(Sipoc, false).ok).toBe(true);
		expect(validateContract(UserJourney, false).ok).toBe(true);
		expect(validateContract(Understanding, understanding).ok).toBe(true);
		expect(validateContract(DiscoveryApplicability, applicability).ok).toBe(true);
	});
	it("brainstorm round + final + design", () => {
		expect(validateContract(Design, { title: "t", specMarkdown: "# spec" }).ok).toBe(true);
		const common = { ...applicability && { discoveryApplicability: applicability }, understanding, userStory: false, sipoc: false, userJourney: false, asIs: { summary: "greenfield", files: [] } };
		expect(validateContract(BrainstormRoundContract, { verdict: "pass", blockers: [], round: 1, status: "ready", questions: [], ...common }).ok).toBe(true);
		expect(validateContract(BrainstormContract, { verdict: "pass", blockers: [], rounds: 1, terminatedBy: "llm-ready", qaHistory: [], ...common }).ok).toBe(true);
	});
	it("finalize contracts", () => {
		expect(validateContract(ApprovalGateContract, { verdict: "pass", blockers: [], decision: "approved", summaryShown: "s" }).ok).toBe(true);
		expect(validateContract(WriteSpecContract, { verdict: "pass", blockers: [], specPath: "/p", specRelPath: "spec.md", projectSpecPath: "", committed: false, bytes: 10 }).ok).toBe(true);
		expect(validateContract(SpecReviewContract, { verdict: "pass", blockers: [], status: "Approved" }).ok).toBe(true);
	});
});
