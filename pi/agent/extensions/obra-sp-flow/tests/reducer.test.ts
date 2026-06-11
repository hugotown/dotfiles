import { describe, expect, test } from "bun:test";
import { createInitialState, transition } from "../reducer.ts";
import type { Config, FlowState } from "../types.ts";

const cfg = {
  phases: {} as any,
  limits: { implConcurrency: 4, debugSubcyclesPerError: 5, debugGlobalCap: 15, questionArchitectureThreshold: 3, coverageThreshold: 90 },
  branch: { prefix: "feature", base: "main" },
  finish: { action: "pr" },
  checks: { typecheck: "", lint: "", test: "" },
  skillsDir: "~/x",
} as Config;

const st = (): FlowState => createInitialState("idea", cfg);

describe("reducer", () => {
  test("initial state is IDLE", () => {
    expect(st().phase).toBe("IDLE");
  });

  test("happy path order through VERIFY", () => {
    let s = transition(st(), { type: "START" });
    expect(s.phase).toBe("BRAINSTORM");
    s = transition(s, { type: "BRAINSTORM_DONE", specPath: "/s.md", intent: "feature" });
    expect(s.phase).toBe("PLAN");
    expect(s.specPath).toBe("/s.md");
    s = transition(s, { type: "PLAN_DONE", planPath: "/p.md", fileContracts: [{ path: "a", purpose: "", dependsOn: [] }] });
    expect(s.phase).toBe("BRANCH");
    expect(s.fileContracts).toHaveLength(1);
    s = transition(s, { type: "BRANCH_READY", featureBranch: "feature/x", baseBranch: "main", hasGit: true });
    expect(s.phase).toBe("IMPLEMENT");
    s = transition(s, { type: "IMPLEMENT_DONE", results: [] });
    expect(s.phase).toBe("REVIEW");
    s = transition(s, { type: "REVIEW_DONE", issues: [] });
    expect(s.phase).toBe("VERIFY");
  });

  test("CHECKS_DONE passed -> FINISH, failed -> DEBUG", () => {
    const base = { ...st(), phase: "VERIFY" as const };
    expect(transition(base, { type: "CHECKS_DONE", result: { results: [], coverage: 95, passed: true, failures: [] } }).phase).toBe("FINISH");
    expect(transition(base, { type: "CHECKS_DONE", result: { results: [], coverage: null, passed: false, failures: ["test: failed"] } }).phase).toBe("DEBUG");
  });

  test("DEBUG_DONE returns to VERIFY and stores budgets", () => {
    const s = transition({ ...st(), phase: "DEBUG" }, { type: "DEBUG_DONE", budgets: { x: 2 }, globalCount: 3 });
    expect(s.phase).toBe("VERIFY");
    expect(s.debugBudgets.x).toBe(2);
    expect(s.debugGlobal).toBe(3);
  });

  test("ESCALATE and FINISHED both reach COMPLETE", () => {
    expect(transition({ ...st(), phase: "DEBUG" }, { type: "ESCALATE", reason: "nope" }).escalation).toBe("nope");
    expect(transition({ ...st(), phase: "DEBUG" }, { type: "ESCALATE", reason: "nope" }).phase).toBe("COMPLETE");
    expect(transition({ ...st(), phase: "FINISH" }, { type: "FINISHED" }).phase).toBe("COMPLETE");
  });

  test("RESET returns to IDLE", () => {
    expect(transition({ ...st(), phase: "IMPLEMENT" }, { type: "RESET" }).phase).toBe("IDLE");
  });
});
