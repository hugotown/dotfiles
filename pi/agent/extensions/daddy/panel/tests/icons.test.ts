// panel/tests/icons.test.ts
import { test, expect } from "bun:test";
import { iconFor, colorFor } from "../icons.ts";

test("iconFor returns correct icon for each status", () => {
  expect(iconFor("pending")).toBe("○");
  expect(iconFor("running")).toBe("●");
  expect(iconFor("paused")).toBe("◉");
  expect(iconFor("completed")).toBe("✓");
  expect(iconFor("failed")).toBe("✗");
  expect(iconFor("skipped")).toBe("⊘");
  expect(iconFor("cancelled")).toBe("⊘");
});

test("colorFor returns hex color per status", () => {
  expect(colorFor("running")).toBe("#e0af68");
  expect(colorFor("completed")).toBe("#9ece6a");
  expect(colorFor("failed")).toBe("#f7768e");
  expect(colorFor("pending")).toBe("#565f89");
  expect(colorFor("paused")).toBe("#bb9af7");
  expect(colorFor("skipped")).toBe("#565f89");
  expect(colorFor("cancelled")).toBe("#565f89");
});
