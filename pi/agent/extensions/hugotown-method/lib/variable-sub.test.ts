// lib/variable-sub.test.ts
import { test, expect } from "bun:test";
import { substitute } from "./variable-sub.ts";
import type { SubContext } from "../runtime-types.ts";

const ctx: SubContext = {
  builtins: { ARGUMENTS: "#42", ARTIFACTS_DIR: "/tmp/a" },
  nodeOutputs: { "classify": '{"type":"bug"}', "review-gate": "approved" },
  nodeStructured: { "classify": { type: "bug", severity: "high" } },
};

test("substitutes builtins", () => {
  expect(substitute("issue $ARGUMENTS in $ARTIFACTS_DIR", ctx)).toBe("issue #42 in /tmp/a");
});

test("substitutes node output (incl. hyphenated id)", () => {
  expect(substitute("gate=$review-gate.output", ctx)).toBe("gate=approved");
});

test("substitutes structured field", () => {
  expect(substitute("t=$classify.output.severity", ctx)).toBe("t=high");
});

test("leaves unknown vars intact", () => {
  expect(substitute("$UNKNOWN", ctx)).toBe("$UNKNOWN");
});
