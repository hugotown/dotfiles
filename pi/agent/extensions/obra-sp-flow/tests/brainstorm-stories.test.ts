import { describe, expect, test } from "bun:test";
import { validateStories } from "../phases/brainstorm/stories.ts";

const good = `
As a scorecard owner, I want to create a scorecard with weighted sections, so that I can evaluate items proportionally.

Scenario: Create a valid scorecard
  Given I am authenticated as an org member
  When I submit a scorecard with sections summing to 100%
  Then the scorecard is persisted and returned with its ID

As a scorecard owner, I want to delete a scorecard, so that I can remove outdated evaluations.

Scenario: Hard delete a scorecard
  Given I own the scorecard
  When I request deletion
  Then the scorecard is permanently removed from the database
`;

describe("validateStories", () => {
  test("a complete set of stories passes", () => {
    const result = validateStories(good);
    expect(result.valid).toBe(true);
    expect(result.problems).toEqual([]);
  });

  test("flags too-short content", () => {
    const result = validateStories("short");
    expect(result.valid).toBe(false);
    expect(result.problems.some((p) => p.includes("too short"))).toBe(true);
  });

  test("flags missing Given/When/Then structure", () => {
    const noGWT = "As a user, I want to do something, so that I benefit.\n".repeat(5);
    const result = validateStories(noGWT);
    expect(result.valid).toBe(false);
    expect(result.problems.some((p) => p.includes("Given/When/Then"))).toBe(true);
  });

  test("flags missing user role", () => {
    const noRole = `
Scenario: Something happens
  Given a precondition
  When an action occurs
  Then the expected result
`;
    const result = validateStories(noRole);
    expect(result.valid).toBe(false);
    expect(result.problems.some((p) => p.includes("user role"))).toBe(true);
  });

  test("accepts Spanish variants (Dado/Cuando/Entonces, Como un)", () => {
    const spanish = `
Como un administrador, quiero gestionar usuarios, para que el sistema se mantenga seguro.

Escenario: Crear usuario
  Dado que estoy autenticado como admin
  Cuando creo un usuario nuevo
  Entonces el usuario aparece en la lista
`;
    const result = validateStories(spanish);
    expect(result.valid).toBe(true);
    expect(result.problems).toEqual([]);
  });
});
