// tests/write-spec.test.ts
import { describe, expect, test } from "bun:test";
import { assembleSpec, generateSpecPath } from "../steps/write-spec.ts";

describe("generateSpecPath", () => {
  test("generates slug from title", () => {
    const path = generateSpecPath("/home/user/project", "Auth Module Design");
    expect(path).toContain("auth-module-design");
    expect(path).toContain("docs/superpowers/specs/");
    expect(path).toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(path).toEndWith("-design.md");
  });
});

describe("assembleSpec", () => {
  test("produces valid markdown with all sections", () => {
    const spec = assembleSpec({
      title: "Test Design",
      selectedApproach: "Approach A",
      assumptions: [
        { id: "a1", text: "Using React", confidence: "high" },
      ],
      answers: { q1: "REST API" },
      questions: [{ id: "q1", label: "API style", type: "select", options: ["REST", "GraphQL"], default: "REST", reasoning: "Standard" }],
      sections: [
        { id: "arch", title: "Architecture", content: "Modular design" },
      ],
    });

    expect(spec).toContain("# Design: Test Design");
    expect(spec).toContain("Approach A");
    expect(spec).toContain("Using React");
    expect(spec).toContain("API style");
    expect(spec).toContain("REST API");
    expect(spec).toContain("## Architecture");
    expect(spec).toContain("Modular design");
  });
});
