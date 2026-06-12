// lib/semaphore.test.ts
import { test, expect } from "bun:test";
import { createSemaphore } from "./semaphore.ts";

test("limits concurrency", async () => {
  const sem = createSemaphore(2);
  let active = 0, peak = 0;
  const task = async () => {
    await sem.acquire();
    active++; peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, 10));
    active--; sem.release();
  };
  await Promise.all([task(), task(), task(), task()]);
  expect(peak).toBeLessThanOrEqual(2);
});
