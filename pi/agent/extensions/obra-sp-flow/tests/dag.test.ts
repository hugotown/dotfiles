import { describe, expect, test } from "bun:test";
import { buildLevels } from "../lib/dag.ts";
import type { FileContract } from "../types.ts";

const c = (path: string, dependsOn: string[] = []): FileContract => ({ path, purpose: "", dependsOn });

describe("buildLevels", () => {
  test("independent files collapse into one level", () => {
    const lv = buildLevels([c("a"), c("b")]);
    expect(lv).toHaveLength(1);
    expect(lv[0].map((x) => x.path).sort()).toEqual(["a", "b"]);
  });

  test("linear chain yields one file per level", () => {
    const lv = buildLevels([c("a"), c("b", ["a"]), c("c", ["b"])]);
    expect(lv.map((l) => l.map((x) => x.path))).toEqual([["a"], ["b"], ["c"]]);
  });

  test("diamond resolves in three levels", () => {
    const lv = buildLevels([c("a"), c("b", ["a"]), c("c", ["a"]), c("d", ["b", "c"])]);
    expect(lv[0].map((x) => x.path)).toEqual(["a"]);
    expect(lv[1].map((x) => x.path).sort()).toEqual(["b", "c"]);
    expect(lv[2].map((x) => x.path)).toEqual(["d"]);
  });

  test("dependencies outside the contract set are ignored", () => {
    const lv = buildLevels([c("a", ["vendor/x.ts"])]);
    expect(lv).toHaveLength(1);
    expect(lv[0][0].path).toBe("a");
  });

  test("a cycle is dumped into a final level (no infinite loop)", () => {
    const lv = buildLevels([c("a", ["b"]), c("b", ["a"])]);
    expect(lv).toHaveLength(1);
    expect(lv[0]).toHaveLength(2);
  });

  test("empty input -> empty levels", () => {
    expect(buildLevels([])).toEqual([]);
  });
});
