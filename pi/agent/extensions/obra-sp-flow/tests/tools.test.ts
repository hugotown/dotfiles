import { describe, expect, test } from "bun:test";
import { EXPLORE, WRITE, defaultTools, phaseTools } from "../lib/tools.ts";
import type { PhaseKey } from "../types.ts";

describe("tool allowlists", () => {
  test("EXPLORE is read-only (no write/edit)", () => {
    expect(EXPLORE).not.toContain("write");
    expect(EXPLORE).not.toContain("edit");
  });

  test("WRITE extends EXPLORE with write/edit", () => {
    expect(WRITE).toContain("read");
    expect(WRITE).toContain("write");
    expect(WRITE).toContain("edit");
  });

  test("brainstorm default has obra_spec + ask_user_question but no write", () => {
    const t = defaultTools("brainstorm");
    expect(t).toContain("obra_spec");
    expect(t).toContain("ask_user_question");
    expect(t).not.toContain("write");
  });

  test("autonomous default includes write and gemini research", () => {
    const t = defaultTools("implement");
    expect(t).toContain("write");
    expect(t).toContain("gemini_google_search");
  });

  test("no phase default ever lists ast-grep (it is a CLI, not a tool)", () => {
    const keys: PhaseKey[] = ["brainstorm", "plan", "implement", "implement_escalate", "review", "debug"];
    for (const k of keys) expect(defaultTools(k)).not.toContain("ast-grep");
  });

  test("phaseTools: override wins, empty falls back to default", () => {
    expect(phaseTools("implement", ["read"])).toEqual(["read"]);
    expect(phaseTools("plan", [])).toEqual(defaultTools("plan"));
  });
});
