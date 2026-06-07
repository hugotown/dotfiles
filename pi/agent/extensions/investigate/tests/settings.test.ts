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
