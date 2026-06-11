import { describe, expect, test } from "bun:test";
import { fillTools } from "../commands/init.ts";

const yaml = ["phases:", "  brainstorm:", "    tools: []", "  implement:", "    tools: []"].join("\n");

describe("fillTools", () => {
  test("brainstorm gets ask_user_question plus the curated set", () => {
    const brainstorm = fillTools(yaml).split("  implement:")[0];
    expect(brainstorm).toContain("- ask_user_question");
    expect(brainstorm).toContain("- obra_spec");
    expect(brainstorm).toContain("- curl");
  });

  test("autonomous phases get the curated set without ask_user_question/subagent", () => {
    const implement = fillTools(yaml).split("  implement:")[1];
    expect(implement).not.toContain("ask_user_question");
    expect(implement).not.toContain("subagent");
    expect(implement).toContain("- write");
    expect(implement).toContain("- gemini_google_search");
  });

  test("non-empty tools blocks are left untouched", () => {
    const y = ["phases:", "  plan:", "    tools:", "      - read"].join("\n");
    expect(fillTools(y)).toBe(y);
  });
});
