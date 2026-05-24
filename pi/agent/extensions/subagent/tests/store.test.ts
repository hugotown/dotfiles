import { describe, expect, test } from "bun:test";
import { emptyResult } from "../result.ts";
import { getRun, hasWorkingSubagent, publishRun, subscribe } from "../lib/store.ts";
import { spec } from "./fixtures.ts";

describe("store", () => {
	test("publishRun replaces the snapshot and notifies subscribers", () => {
		let calls = 0;
		const unsubscribe = subscribe(() => calls++);
		publishRun([emptyResult(spec("a"), "running")]);
		expect(getRun().map((r) => r.name)).toEqual(["a"]);
		expect(calls).toBe(1);
		unsubscribe();
		publishRun([]);
		expect(calls).toBe(1); // no longer notified after unsubscribe
	});

	test("hasWorkingSubagent reflects running agents", () => {
		publishRun([emptyResult(spec("a"), "ok"), emptyResult(spec("b"), "running")]);
		expect(hasWorkingSubagent()).toBe(true);
		publishRun([emptyResult(spec("a"), "ok"), emptyResult(spec("b"), "failed")]);
		expect(hasWorkingSubagent()).toBe(false);
	});
});
