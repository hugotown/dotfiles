import { describe, expect, test } from "bun:test";
import { compressBrainstorm } from "../phases/brainstorm/compress.ts";
import { PHASE_MARKER } from "../orchestrator.ts";

const marker = { customType: PHASE_MARKER, content: "core+repo map" };

describe("compressBrainstorm", () => {
  test("collapses post-marker conversation to [marker, ledger]", () => {
    const msgs = [
      { role: "user", content: "stale pre-brainstorm history" },
      marker,
      { role: "assistant", content: [{ type: "thinking", thinking: "..." }, { type: "toolCall", id: "1", name: "ask_user_question", arguments: {} }] },
      { role: "toolResult", toolCallId: "1", toolName: "ask_user_question", content: [{ type: "text", text: "answered" }] },
    ];
    const out = compressBrainstorm(msgs, "### Decisions resolved so far\n- Q1 => A1");
    expect(out).toHaveLength(2);
    expect((out[0] as { customType?: string }).customType).toBe(PHASE_MARKER);
    expect((out[1] as { role?: string }).role).toBe("user");
    expect((out[1] as { content?: string }).content).toContain("Q1 => A1");
  });

  test("no ledger yet -> just the marker (drops stale pre-marker history)", () => {
    const out = compressBrainstorm([{ role: "user", content: "x" }, marker], "");
    expect(out).toHaveLength(1);
    expect((out[0] as { customType?: string }).customType).toBe(PHASE_MARKER);
  });

  test("no marker -> unchanged (safe no-op)", () => {
    const msgs = [{ role: "user", content: "x" }];
    expect(compressBrainstorm(msgs, "L")).toBe(msgs);
  });
});
