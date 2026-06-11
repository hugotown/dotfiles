import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { loadConfig } from "../lib/config-load.ts";

function projectWith(yml: string): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "obra-cfg-"));
  fs.mkdirSync(path.join(d, ".pi", "obra-sp-flow"), { recursive: true });
  fs.writeFileSync(path.join(d, ".pi", "obra-sp-flow", "obra-sp-flow.yml"), yml);
  return d;
}

describe("loadConfig", () => {
  test("defaults load from the extension config.yml", () => {
    const c = loadConfig(os.tmpdir(), false);
    expect(c.phases.brainstorm.provider).toBe("minimax");
    expect(c.limits.debugGlobalCap).toBe(15);
    expect(c.finish.action).toBe("pr");
  });

  test("untrusted projects ignore the override file", () => {
    const d = projectWith("finish:\n  action: keep\n");
    expect(loadConfig(d, false).finish.action).toBe("pr");
  });

  test("trusted projects deep-merge the override (siblings preserved)", () => {
    const d = projectWith("finish:\n  action: keep\nphases:\n  implement:\n    model: custom-model\n");
    const c = loadConfig(d, true);
    expect(c.finish.action).toBe("keep");
    expect(c.phases.implement.model).toBe("custom-model");
    expect(c.phases.implement.provider).toBe("minimax");
  });

  test("$ENV references resolve in overrides", () => {
    process.env.OBRA_TEST_MODEL = "env-model";
    const d = projectWith('phases:\n  plan:\n    model: "$OBRA_TEST_MODEL"\n');
    expect(loadConfig(d, true).phases.plan.model).toBe("env-model");
  });

  test("per-phase rules and tools overrides apply", () => {
    const d = projectWith("phases:\n  implement:\n    rules:\n      - r1\n    tools:\n      - read\n");
    const c = loadConfig(d, true);
    expect(c.phases.implement.rules).toEqual(["r1"]);
    expect(c.phases.implement.tools).toEqual(["read"]);
  });
});
