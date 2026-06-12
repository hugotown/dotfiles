// lib/completion.test.ts
import { test, expect } from "bun:test";
import { detectSignal, stripSignalTags } from "./completion.ts";

test("detects <promise> tag matching until", () => {
  expect(detectSignal("work done\n<promise>COMPLETE</promise>", "COMPLETE")).toBe(true);
  expect(detectSignal("<promise>NOPE</promise>", "COMPLETE")).toBe(false);
});

test("detects default signal without until", () => {
  expect(detectSignal("all good\n<promise>DONE</promise>")).toBe(true);
});

test("detects trailing plain signal", () => {
  expect(detectSignal("finished\nCOMPLETE", "COMPLETE")).toBe(true);
});

test("strips promise tags", () => {
  expect(stripSignalTags("text\n<promise>COMPLETE</promise>")).toBe("text");
});
