// Pure skill-load detection logic.
//
// pi has NO dedicated "skill loaded" event. A skill is loaded iff the agent
// issues a `read` on .../skills/<name>/SKILL.md — that read is the only
// programmatic signal. This module turns a read path into a skill name and
// tracks which skills have been seen. Kept pure so it is unit-testable; the
// live `tool_call` wiring lives in index.ts.

const SKILL_PATH = /\/skills\/([^/]+)\/SKILL\.md$/;

/** Extract the skill name from a read path, or null if it is not a SKILL.md read. */
export function skillFromReadPath(path: string): string | null {
  const match = SKILL_PATH.exec(path);
  return match ? match[1] : null;
}

/** Records skills seen this session (MAIN depth only — see index.ts caveat). */
export class SkillTracker {
  private readonly loaded = new Set<string>();

  /** Record a skill load. Returns whether it was the first time this session. */
  record(skill: string): { skill: string; firstLoad: boolean } {
    const firstLoad = !this.loaded.has(skill);
    this.loaded.add(skill);
    return { skill, firstLoad };
  }

  /** All skills detected this session, sorted. */
  list(): string[] {
    return [...this.loaded].sort();
  }
}
