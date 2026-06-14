// index.report.test.ts — makeReport gates the main agent transcript on panel state.
import { test, expect } from "bun:test";
import { makeReport } from "./index.ts";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function fakePi(): { pi: ExtensionAPI; sent: unknown[] } {
  const sent: unknown[] = [];
  return {
    sent,
    pi: { sendMessage: (m: unknown) => { sent.push(m); } } as unknown as ExtensionAPI,
  };
}

test("makeReport: sends to the main agent when the panel is closed", () => {
  const { pi, sent } = fakePi();
  const { report } = makeReport(pi, () => false);
  report("Workflow done: 2/2");
  expect(sent).toHaveLength(1);
  expect((sent[0] as { customType: string; content: string }).content).toBe("Workflow done: 2/2");
});

test("makeReport: suppresses the send while the panel is open (no [daddy] block in main agent)", () => {
  const { pi, sent } = fakePi();
  const { report } = makeReport(pi, () => true);
  report("Workflow done: 2/2");
  expect(sent).toEqual([]);
});

test("makeReport: flushPending replays the suppressed report after the panel closes", () => {
  const { pi, sent } = fakePi();
  const { report, flushPending } = makeReport(pi, () => true);
  report("suppressed while panel was open");
  expect(sent).toEqual([]);
  flushPending();
  expect(sent).toHaveLength(1);
  expect((sent[0] as { content: string }).content).toBe("suppressed while panel was open");
});

test("makeReport: flushPending is a no-op when nothing was suppressed", () => {
  const { pi, sent } = fakePi();
  const { flushPending } = makeReport(pi, () => false);
  flushPending();
  expect(sent).toEqual([]);
});

test("makeReport: only the most recent suppressed report is replayed", () => {
  const { pi, sent } = fakePi();
  const { report, flushPending } = makeReport(pi, () => true);
  report("first");
  report("second");
  flushPending();
  expect(sent).toHaveLength(1);
  expect((sent[0] as { content: string }).content).toBe("second");
});
