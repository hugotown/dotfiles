import { describe, expect, test } from "bun:test";
import { loadCore } from "../lib/cores.ts";

describe("cores loader", () => {
  test("brainstorming core loads and is distilled (non-empty, keeps the signal)", () => {
    const core = loadCore("brainstorming");
    expect(core.length).toBeGreaterThan(100);
    expect(core).toContain("YAGNI");
    expect(core).toContain("done=true");
  });

  test("brainstorming core drops the conflicting skill machinery", () => {
    const core = loadCore("brainstorming");
    expect(core).not.toContain("writing-plans");
    expect(core).not.toContain("HARD-GATE");
    expect(core).not.toContain("Visual Companion");
  });

  test("writing-plans core loads and drops the execution-handoff conflict", () => {
    const core = loadCore("writing-plans");
    expect(core.length).toBeGreaterThan(100);
    expect(core).toContain("TDD");
    expect(core).not.toContain("Execution Handoff");
    expect(core).not.toContain("subagent-driven-development");
  });

  test("missing core degrades to empty string", () => {
    expect(loadCore("does-not-exist")).toBe("");
  });
});
