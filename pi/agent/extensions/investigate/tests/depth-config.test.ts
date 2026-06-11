import { describe, expect, test } from "bun:test";
import { resolveDepth } from "../lib/depth-config.ts";
import type { DepthProfile, InvestigateConfig } from "../types.ts";

function makeProfile(n: number): DepthProfile {
  return {
    sub_questions: n,
    curls_per_subpi: n,
    concurrency_limit: n,
    thinking: "medium",
    subpi_timeout_ms: 60000,
    investigator_max_retries: 1,
    synth_timeout_ms: 60000,
    wall_clock_budget_ms: 300000,
    planner: { provider: "p", model: "m" },
    investigator: { provider: "p", model: "m" },
    synthesizer: { provider: "p", model: "m" },
  };
}

const config: InvestigateConfig = {
  defaults: { freshness: "year" },
  depths: { light: makeProfile(3), medium: makeProfile(5), high: makeProfile(8), deep: makeProfile(12) },
  limits: { max_subpi_text_kb: 30, max_synthesizer_tokens: 4096, max_planner_tokens: 1024 },
  bash_guard: { enabled: true, block_commands: ["curl"] },
};

describe("resolveDepth", () => {
  test("returns the matching profile", () => {
    expect(resolveDepth(config, "light").sub_questions).toBe(3);
    expect(resolveDepth(config, "deep").sub_questions).toBe(12);
  });

  test("returned object is a fresh shallow copy (caller may not mutate config)", () => {
    const p = resolveDepth(config, "medium");
    p.sub_questions = 99;
    expect(config.depths.medium.sub_questions).toBe(5);
  });
});
