// lib/retry.test.ts
import { test, expect } from "bun:test";
import { classifyError, withRetry } from "./retry.ts";

test("classifies errors", () => {
  expect(classifyError("Permission denied")).toBe("fatal");
  expect(classifyError("process exited with code 1")).toBe("transient");
  expect(classifyError("weird thing")).toBe("unknown");
});

test("retries transient then succeeds", async () => {
  let n = 0;
  const r = await withRetry(async () => {
    if (n++ < 1) throw new Error("network timeout");
    return "ok";
  }, { max_attempts: 2, delay_ms: 1000 }, (k) => k === "transient");
  expect(r).toBe("ok");
  expect(n).toBe(2);
});

test("does not retry fatal", async () => {
  let n = 0;
  await expect(withRetry(async () => { n++; throw new Error("unauthorized"); },
    { max_attempts: 3, delay_ms: 1000 }, (k) => k !== "fatal")).rejects.toThrow();
  expect(n).toBe(1);
});
