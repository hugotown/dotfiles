// tests/integration/runner.itest.ts — Spawns a REAL pi subprocess.
import { test, expect } from "bun:test";
import { runPi } from "../../lib/runner.ts";
import { enforceOutput } from "../../lib/output-schema.ts";
import { defaultModel } from "./helpers.ts";

const { provider, model } = defaultModel();

test("mechanics: real pi run returns ok with output", async () => {
  const r = await runPi({ provider, model, thinking: "low", system: "Be terse.", task: "Reply with the single word: READY", cwd: process.cwd() });
  expect(r.status).toBe("ok");
  expect(r.output.toUpperCase()).toContain("READY");
}, 120000);

test("schema: structured JSON conforms to a schema", async () => {
  const r = await runPi({ provider, model, thinking: "low", system: "Output JSON only, no prose.", task: 'Return {"type":"bug"} as JSON.', cwd: process.cwd() });
  const v = enforceOutput(r.output, { type: "object", properties: { type: { type: "string" } }, required: ["type"] });
  expect(v.ok).toBe(true);
}, 120000);
