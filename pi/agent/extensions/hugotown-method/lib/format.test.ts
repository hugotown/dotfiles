// lib/format.test.ts
import { test, expect } from "bun:test";
import { statusIcon, fmtDuration } from "./format.ts";

test("maps statuses to icons", () => {
  expect(statusIcon("completed")).toBe("✓");
  expect(statusIcon("failed")).toBe("✗");
});

test("formats durations", () => {
  expect(fmtDuration(500)).toBe("500ms");
  expect(fmtDuration(2500)).toBe("2.5s");
  expect(fmtDuration(65000)).toBe("1m5s");
});
