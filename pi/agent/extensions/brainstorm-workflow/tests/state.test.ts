// tests/state.test.ts
import { describe, expect, test } from "bun:test";
import { type BrainstormState, createInitialState, transition } from "../state.ts";

describe("BrainstormState", () => {
  test("createInitialState returns IDLE phase", () => {
    const state = createInitialState();
    expect(state.phase).toBe("IDLE");
    expect(state.originalPrompt).toBe("");
  });

  test("transition from IDLE to GATHERING_CONTEXT sets prompt", () => {
    const state = createInitialState();
    const next = transition(state, "START", { prompt: "build an auth module" });
    expect(next.phase).toBe("GATHERING_CONTEXT");
    expect(next.originalPrompt).toBe("build an auth module");
  });

  test("transition from GATHERING_CONTEXT to RESEARCHING sets context", () => {
    const state: BrainstormState = {
      ...createInitialState(),
      phase: "GATHERING_CONTEXT",
      originalPrompt: "build auth",
    };
    const next = transition(state, "CONTEXT_GATHERED", {
      compressedContext: "project: my-app\ndeps: react, next",
    });
    expect(next.phase).toBe("RESEARCHING_AND_QUESTIONING");
    expect(next.compressedContext).toBe("project: my-app\ndeps: react, next");
  });

  test("invalid transition returns same state", () => {
    const state = createInitialState();
    const next = transition(state, "CONTEXT_GATHERED", { compressedContext: "" });
    expect(next).toBe(state);
  });
});
