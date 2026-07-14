import { describe, expect, test } from "bun:test";
import { SkillTracker, skillFromReadPath } from "../lib/skill-detector.ts";

describe("skillFromReadPath", () => {
  test("extracts the skill name from a SKILL.md read", () => {
    expect(
      skillFromReadPath("/repo/.pi/skills/using-superpowers/SKILL.md"),
    ).toBe("using-superpowers");
    expect(
      skillFromReadPath("/a/.agents/skills/writing-plans/SKILL.md"),
    ).toBe("writing-plans");
  });

  test("returns null for non-skill reads", () => {
    expect(skillFromReadPath("/repo/src/index.ts")).toBeNull();
    expect(skillFromReadPath("/repo/skills/foo/README.md")).toBeNull();
    expect(skillFromReadPath("/repo/skills/SKILL.md")).toBeNull();
  });
});

describe("SkillTracker", () => {
  test("firstLoad is true only the first time, list is sorted+deduped", () => {
    const t = new SkillTracker();
    expect(t.record("brainstorming").firstLoad).toBe(true);
    expect(t.record("brainstorming").firstLoad).toBe(false);
    t.record("using-superpowers");
    expect(t.list()).toEqual(["brainstorming", "using-superpowers"]);
  });
});
