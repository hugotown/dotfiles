// lib/branch-name.test.ts
import { test, expect } from "bun:test";
import { makeBranchName } from "./branch-name.ts";

test("produces a slugged, prefixed, unique branch", () => {
  const b = makeBranchName("Fix Issue!");
  expect(b).toMatch(/^daddy\/fix-issue-[a-z0-9]{6}$/);
});

test("two calls differ", () => {
  expect(makeBranchName("w")).not.toBe(makeBranchName("w"));
});
