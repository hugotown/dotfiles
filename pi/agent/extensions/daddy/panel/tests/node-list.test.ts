// panel/tests/node-list.test.ts
import { describe, test, expect } from "bun:test";
import { renderNodeList } from "../node-list.ts";
import type { NodeStatus } from "../../runtime-types.ts";

const nodes = (statuses: NodeStatus[]) =>
  statuses.map((s, i) => ({ id: `node-${i}`, status: s }));

describe("renderNodeList", () => {
  test("renders nodes with correct icons and selection marker", () => {
    const lines = renderNodeList(nodes(["running", "pending", "completed"]), 0, 20, 5);
    expect(lines).toHaveLength(5);
    expect(lines[0]).toContain(">");
    expect(lines[0]).toContain("node-0");
    expect(lines[1]).toContain("·");
    expect(lines[2]).toContain("+");
  });

  test("selected node is marked with >", () => {
    const lines = renderNodeList(nodes(["pending", "running"]), 1, 20, 5);
    expect(lines[1]).toContain(">");
    expect(lines[0]).not.toContain(">");
  });

  test("pads empty rows when fewer nodes than height", () => {
    const lines = renderNodeList(nodes(["pending"]), 0, 20, 4);
    expect(lines).toHaveLength(4);
  });

  test("windows when nodes exceed height", () => {
    const many = nodes(Array(10).fill("pending") as NodeStatus[]);
    const lines = renderNodeList(many, 8, 20, 4);
    expect(lines).toHaveLength(4);
    expect(lines.some((l) => l.includes("node-8"))).toBe(true);
  });

  test("applies status color to node rows via truecolor ANSI", () => {
    const lines = renderNodeList(nodes(["running"]), 0, 20, 1);
    expect(lines[0]).toContain("\x1b[38;2;");   // truecolor foreground opener
    expect(lines[0]).toContain("\x1b[39m");      // foreground reset
    expect(lines[0]).toContain(">");             // plain content preserved
    expect(lines[0]).toContain("node-0");
  });

  test("empty padding rows are not colored", () => {
    const lines = renderNodeList(nodes(["running"]), 0, 20, 3);
    expect(lines[1]).not.toContain("\x1b[");
  });

  test("pads selected node lines to the requested visible width", () => {
    const lines = renderNodeList(nodes(["running"]), 0, 24, 1);
    const visible = lines[0].replace(/\x1b\[[0-9;]*m/g, "");
    expect(visible.length).toBe(24);
  });

  test("truncates long node ids to fit the requested visible width", () => {
    const lines = renderNodeList([{ id: "very-long-interview-node-id", status: "running" }], 0, 12, 1);
    const visible = lines[0].replace(/\x1b\[[0-9;]*m/g, "");
    expect(visible.length).toBe(12);
    expect(visible).toContain("…");
    expect(visible).not.toContain("interview");
  });

  test("frame wrap preserves right edge when left column has ANSI colors", () => {
    const lines = renderNodeList(nodes(["running"]), 0, 24, 1);
    const visible = lines[0].replace(/\x1b\[[0-9;]*m/g, "");
    expect(visible.length).toBe(24);
  });
});
