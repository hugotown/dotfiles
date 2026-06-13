// panel/tests/stream-view.test.ts
import { describe, test, expect } from "bun:test";
import { renderStreamView } from "../stream-view.ts";
import type { StreamEntry } from "../store.ts";

const entry = (content: string, type: StreamEntry["type"] = "text"): StreamEntry =>
  ({ type, content, timestamp: Date.now() });

describe("renderStreamView", () => {
  test("renders entries tailed to height", () => {
    const entries = Array.from({ length: 20 }, (_, i) => entry(`line ${i}`));
    const lines = renderStreamView(entries, 40, 5);
    expect(lines).toHaveLength(5);
    expect(lines[4]).toContain("line 19");
  });

  test("empty entries produces blank lines", () => {
    const lines = renderStreamView([], 30, 4);
    expect(lines).toHaveLength(4);
    lines.forEach((l) => expect(l.trim()).toBe(""));
  });

  test("tool_call entries are prefixed with arrow", () => {
    const lines = renderStreamView([entry("bash run", "tool_call")], 40, 3);
    expect(lines[2]).toContain("→ bash run");
  });

  test("status entries are prefixed with bracket", () => {
    const lines = renderStreamView([entry("completed", "status")], 40, 3);
    expect(lines[2]).toContain("[completed]");
  });

  test("long lines are word-wrapped", () => {
    const long = "word ".repeat(20).trim();
    const lines = renderStreamView([entry(long)], 20, 10);
    expect(lines.length).toBe(10);
    // At least one line should contain "word"
    expect(lines.some((l) => l.includes("word"))).toBe(true);
  });

  test("returns an empty array when height is zero", () => {
    expect(renderStreamView([entry("x")], 20, 0)).toEqual([]);
  });
});
