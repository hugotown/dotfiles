import { describe, expect, test } from "bun:test";
import { featureSlug, planPath, specPath } from "../lib/paths.ts";

describe("paths", () => {
  test("slug normalizes and trims", () => {
    expect(featureSlug("Add Dark Mode!!")).toBe("add-dark-mode");
  });

  test("slug falls back to 'feature' for empty input", () => {
    expect(featureSlug("!!!")).toBe("feature");
  });

  test("slug is capped at 50 chars", () => {
    expect(featureSlug("a".repeat(80)).length).toBeLessThanOrEqual(50);
  });

  test("spec path under docs/superpowers/specs with -design suffix", () => {
    expect(specPath("/p", "Foo Bar")).toMatch(/\/p\/docs\/superpowers\/specs\/\d{4}-\d{2}-\d{2}-foo-bar-design\.md$/);
  });

  test("plan path under docs/superpowers/plans", () => {
    expect(planPath("/p", "Foo Bar")).toMatch(/\/p\/docs\/superpowers\/plans\/\d{4}-\d{2}-\d{2}-foo-bar\.md$/);
  });
});
