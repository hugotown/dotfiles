import { describe, expect, test } from "bun:test";
import { buildCatalog, CatalogStore } from "../lib/work-catalog.ts";

describe("buildCatalog", () => {
  test("counts, trims, and drops blanks", () => {
    const c = buildCatalog(
      ["  kiosk screen for HRM  ", "", "reporting dashboard"],
      ["fix authentication", "   "],
    );
    expect(c.counts).toEqual({ requirements: 2, issues: 1 });
    expect(c.requirements).toEqual(["kiosk screen for HRM", "reporting dashboard"]);
    expect(c.issues).toEqual(["fix authentication"]);
    expect(typeof c.ts).toBe("string");
  });

  test("empty input yields zero counts", () => {
    expect(buildCatalog([], []).counts).toEqual({ requirements: 0, issues: 0 });
  });
});

describe("CatalogStore", () => {
  test("accumulates totals across catalogs and keeps the latest", () => {
    const store = new CatalogStore();
    expect(store.total()).toEqual({ requirements: 0, issues: 0 });
    expect(store.last()).toBeUndefined();

    store.add(buildCatalog(["a", "b"], ["x"]));
    store.add(buildCatalog(["c"], ["y", "z"]));

    expect(store.total()).toEqual({ requirements: 3, issues: 3 });
    expect(store.last()?.requirements).toEqual(["c"]);
  });
});
