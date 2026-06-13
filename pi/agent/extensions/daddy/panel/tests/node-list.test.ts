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
    expect(lines[0]).toContain("●");
    expect(lines[0]).toContain("node-0");
    expect(lines[1]).toContain("○");
    expect(lines[2]).toContain("✓");
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
});
