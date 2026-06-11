import { afterEach, describe, expect, test } from "bun:test";
import { parseConfig, resolveValue, validateConfig } from "../lib/settings.ts";

const savedEnv = { ...process.env };
afterEach(() => { process.env = { ...savedEnv }; });

function minimalRaw() {
  const mkRole = () => ({ provider: "p", model: "m" });
  const mkDepth = () => ({
    sub_questions: "3",
    curls_per_subpi: "3",
    concurrency_limit: "3",
    thinking: "low",
    subpi_timeout_ms: "60000",
    planner: mkRole(),
    investigator: mkRole(),
    synthesizer: mkRole(),
  });
  return {
    defaults: { freshness: "year" },
    depths: { light: mkDepth(), medium: mkDepth(), high: mkDepth(), deep: mkDepth() },
    limits: { max_subpi_text_kb: "30", max_synthesizer_tokens: "4096", max_planner_tokens: "1024" },
    bash_guard: { enabled: "true", block_commands: ["curl"] },
  };
}

describe("resolveValue (duplicated logic; should behave like curl/)", () => {
  test("$VAR:default works with newlines/colons in default (the /s flag)", () => {
    delete process.env.X;
    expect(resolveValue("$X:line1\nline2:colon")).toBe("line1\nline2:colon");
  });
});

describe("validateConfig", () => {
  test("coerces strings to numbers and booleans across all depths", () => {
    const c = validateConfig(minimalRaw());
    for (const depth of ["light", "medium", "high", "deep"] as const) {
      expect(c.depths[depth].sub_questions).toBe(3);
      expect(c.depths[depth].subpi_timeout_ms).toBe(60000);
      expect(c.depths[depth].thinking).toBe("low");
    }
    expect(c.bash_guard.enabled).toBe(true);
    expect(c.limits.max_subpi_text_kb).toBe(30);
  });

  test("throws when a required depth is missing", () => {
    const raw = minimalRaw();
    delete (raw.depths as Record<string, unknown>).deep;
    expect(() => validateConfig(raw)).toThrow(/depths\.deep/);
  });

  test("throws when a depth role is missing", () => {
    const raw = minimalRaw();
    raw.depths.high.investigator = { provider: "", model: "m" };
    expect(() => validateConfig(raw)).toThrow(/depths\.high\.investigator\.provider/);
  });

  test("throws on invalid thinking enum", () => {
    const raw = minimalRaw();
    raw.depths.medium.thinking = "extreme";
    expect(() => validateConfig(raw)).toThrow(/thinking/);
  });

  test("freshness must be one of any/day/week/month/year", () => {
    const raw = minimalRaw();
    raw.defaults.freshness = "decade";
    expect(() => validateConfig(raw)).toThrow(/freshness/);
  });

  test("investigator_max_retries defaults to 1 when omitted", () => {
    const c = validateConfig(minimalRaw());
    for (const depth of ["light", "medium", "high", "deep"] as const) {
      expect(c.depths[depth].investigator_max_retries).toBe(1);
    }
  });

  test("investigator_max_retries accepts 0 (no retries)", () => {
    const raw = minimalRaw();
    (raw.depths.light as Record<string, unknown>).investigator_max_retries = "0";
    const c = validateConfig(raw);
    expect(c.depths.light.investigator_max_retries).toBe(0);
  });

  test("investigator_max_retries rejects negative values", () => {
    const raw = minimalRaw();
    (raw.depths.medium as Record<string, unknown>).investigator_max_retries = "-1";
    expect(() => validateConfig(raw)).toThrow(/investigator_max_retries/);
  });

  test("synth_timeout_ms defaults to subpi_timeout_ms when omitted", () => {
    const c = validateConfig(minimalRaw());
    for (const depth of ["light", "medium", "high", "deep"] as const) {
      expect(c.depths[depth].synth_timeout_ms).toBe(c.depths[depth].subpi_timeout_ms);
    }
  });

  test("synth_timeout_ms accepts an explicit override", () => {
    const raw = minimalRaw();
    (raw.depths.high as Record<string, unknown>).synth_timeout_ms = "45000";
    const c = validateConfig(raw);
    expect(c.depths.high.synth_timeout_ms).toBe(45000);
  });

  test("wall_clock_budget_ms defaults to 600000 (10 min) when omitted", () => {
    const c = validateConfig(minimalRaw());
    for (const depth of ["light", "medium", "high", "deep"] as const) {
      expect(c.depths[depth].wall_clock_budget_ms).toBe(600000);
    }
  });

  test("wall_clock_budget_ms accepts an explicit override", () => {
    const raw = minimalRaw();
    (raw.depths.deep as Record<string, unknown>).wall_clock_budget_ms = "900000";
    const c = validateConfig(raw);
    expect(c.depths.deep.wall_clock_budget_ms).toBe(900000);
  });
});

describe("parseConfig (YAML → validated)", () => {
  test("an unresolved $VAR throws with the field path", () => {
    delete process.env.NOPE;
    const yaml = `
defaults:
  freshness: "$NOPE"
depths:
  light: { sub_questions: "3", curls_per_subpi: "3", concurrency_limit: "3", thinking: "low", subpi_timeout_ms: "60000", planner: { provider: p, model: m }, investigator: { provider: p, model: m }, synthesizer: { provider: p, model: m } }
  medium: { sub_questions: "3", curls_per_subpi: "3", concurrency_limit: "3", thinking: "low", subpi_timeout_ms: "60000", planner: { provider: p, model: m }, investigator: { provider: p, model: m }, synthesizer: { provider: p, model: m } }
  high: { sub_questions: "3", curls_per_subpi: "3", concurrency_limit: "3", thinking: "low", subpi_timeout_ms: "60000", planner: { provider: p, model: m }, investigator: { provider: p, model: m }, synthesizer: { provider: p, model: m } }
  deep: { sub_questions: "3", curls_per_subpi: "3", concurrency_limit: "3", thinking: "low", subpi_timeout_ms: "60000", planner: { provider: p, model: m }, investigator: { provider: p, model: m }, synthesizer: { provider: p, model: m } }
limits: { max_subpi_text_kb: "30", max_synthesizer_tokens: "4096", max_planner_tokens: "1024" }
bash_guard: { enabled: "true", block_commands: [] }
`;
    expect(() => parseConfig(yaml)).toThrow(/defaults\.freshness/);
  });
});
