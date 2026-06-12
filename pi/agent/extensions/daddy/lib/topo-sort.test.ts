// lib/topo-sort.test.ts
import { test, expect } from "bun:test";
import { toLayers } from "./topo-sort.ts";

test("groups independent nodes into one layer", () => {
  const layers = toLayers([{ id: "a", bash: "x" }, { id: "b", bash: "y" }]);
  expect(layers).toHaveLength(1);
  expect(layers[0].map((n) => n.id).sort()).toEqual(["a", "b"]);
});

test("orders by dependency", () => {
  const layers = toLayers([
    { id: "c", bash: "z", depends_on: ["a", "b"] },
    { id: "a", bash: "x" }, { id: "b", bash: "y" },
  ]);
  expect(layers.map((l) => l.map((n) => n.id).sort())).toEqual([["a", "b"], ["c"]]);
});
