import { afterEach, describe, expect, mock, test } from "bun:test";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DEFAULT_CONFIG, loadConfig, parseConfig, resolveValue } from "../lib/config-loader.ts";

describe("resolveValue", () => {
  const savedEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  test("resolves literals and env references", () => {
    process.env.FOO = "bar";
    delete process.env.NOPE;

    expect(resolveValue("literal")).toBe("literal");
    expect(resolveValue("$FOO")).toBe("bar");
    expect(resolveValue("$NOPE:fallback")).toBe("fallback");
    expect(resolveValue("$NOPE")).toBe("$NOPE");
    expect(resolveValue(123)).toBe(123);
  });
});

describe("DEFAULT_CONFIG", () => {
  test("is immutable and contains safe defaults", () => {
    expect(DEFAULT_CONFIG).toEqual({
      mode: "warn",
      watch: {
        include: ["**/*"],
        ignore: [],
        maxSizeKb: 500,
      },
      debounceMs: 200,
      cooldownMs: 30000,
      builtInRules: {
        "no-linter-suppressions": true,
        "no-type-suppressions": true,
        "no-runtime-suppressions": true,
        "no-compiler-suppressions": true,
      },
      customRules: [],
    });

    expect(Object.isFrozen(DEFAULT_CONFIG)).toBe(true);
    expect(Object.isFrozen(DEFAULT_CONFIG.watch)).toBe(true);
    expect(Object.isFrozen(DEFAULT_CONFIG.watch.include)).toBe(true);
    expect(Object.isFrozen(DEFAULT_CONFIG.watch.ignore)).toBe(true);
    expect(Object.isFrozen(DEFAULT_CONFIG.builtInRules)).toBe(true);
    expect(Object.isFrozen(DEFAULT_CONFIG.customRules)).toBe(true);
  });
});

describe("parseConfig", () => {
  const savedEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  test("valid YAML resolves env vars deeply and produces typed config", () => {
    process.env.MODE = "strict";
    process.env.INCLUDE = "src/**";
    process.env.IGNORE = "**/*.snap";
    process.env.MAX_SIZE = "123";
    process.env.DEBOUNCE = "50";
    process.env.COOLDOWN = "1000";
    process.env.RUNTIME_RULE = "false";
    process.env.CUSTOM_PATTERN = "//\\s*TODO";

    const config = parseConfig(
      `
mode: "$MODE"
watch:
  include: ["$INCLUDE"]
  ignore: ["$IGNORE"]
  max_size_kb: "$MAX_SIZE"
debounce_ms: "$DEBOUNCE"
cooldown_ms: "$COOLDOWN"
built_in_rules:
  no-runtime-suppressions: "$RUNTIME_RULE"
custom_rules:
  - id: "no-todo"
    name: "No TODO"
    filePatterns: ["**/*.ts"]
    patterns: ["$CUSTOM_PATTERN"]
    message: "Resolve TODO at {line}: {match}"
    severity: "warning"
`,
      { warn: mock(() => {}) },
    );

    expect(config.mode).toBe("strict");
    expect(config.watch.include).toEqual(["src/**"]);
    expect(config.watch.ignore).toEqual(["**/*.snap"]);
    expect(config.watch.maxSizeKb).toBe(123);
    expect(config.debounceMs).toBe(50);
    expect(config.cooldownMs).toBe(1000);
    expect(config.builtInRules["no-runtime-suppressions"]).toBe(false);
    expect(config.customRules).toHaveLength(1);
    expect(config.customRules[0]?.patterns[0]?.source).toBe("\\/\\/\\s*TODO");
    expect(config.customRules[0]?.patterns[0]?.flags).toContain("g");
    expect(config.customRules[0]?.patterns[0]?.flags).toContain("i");
  });

  test("invalid YAML falls back to DEFAULT_CONFIG", () => {
    const warn = mock(() => {});

    expect(parseConfig("mode: [", { warn })).toBe(DEFAULT_CONFIG);
    expect(warn).toHaveBeenCalled();
  });

  test("invalid scalar fields fall back field-by-field", () => {
    const warn = mock(() => {});
    const config = parseConfig(
      `
mode: wat
watch:
  include: nope
  ignore: nope
  max_size_kb: -1
debounce_ms: -1
cooldown_ms: nope
built_in_rules:
  typo-rule: true
`,
      { warn },
    );

    expect(config.mode).toBe(DEFAULT_CONFIG.mode);
    expect(config.watch.include).toEqual(DEFAULT_CONFIG.watch.include);
    expect(config.watch.ignore).toEqual(DEFAULT_CONFIG.watch.ignore);
    expect(config.watch.maxSizeKb).toBe(DEFAULT_CONFIG.watch.maxSizeKb);
    expect(config.debounceMs).toBe(DEFAULT_CONFIG.debounceMs);
    expect(config.cooldownMs).toBe(DEFAULT_CONFIG.cooldownMs);
    expect(config.builtInRules).toEqual(DEFAULT_CONFIG.builtInRules);
    expect(warn).toHaveBeenCalled();
  });

  test("unresolved env refs in watch string arrays fall back and log", () => {
    const warn = mock(() => {});
    const config = parseConfig(
      `
watch:
  include: ["$MISSING_INCLUDE"]
  ignore: ["$MISSING_IGNORE"]
`,
      { warn },
    );

    expect(config.watch.include).toEqual(DEFAULT_CONFIG.watch.include);
    expect(config.watch.ignore).toEqual(DEFAULT_CONFIG.watch.ignore);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("watch.include"));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("watch.ignore"));
  });

  test("rejects invalid modes and negative numbers", () => {
    const warn = mock(() => {});
    const config = parseConfig(
      `
mode: false
watch:
  max_size_kb: "$MISSING:-5"
debounce_ms: "$MISSING:-1"
cooldown_ms: "$MISSING:-2"
`,
      { warn },
    );

    expect(config.mode).toBe("warn");
    expect(config.watch.maxSizeKb).toBe(500);
    expect(config.debounceMs).toBe(200);
    expect(config.cooldownMs).toBe(30000);
    expect(warn).toHaveBeenCalled();
  });

  test("built-in rules accept booleans and string booleans after env resolution", () => {
    process.env.LINTER = "false";
    const warn = mock(() => {});
    const config = parseConfig(
      `
built_in_rules:
  no-linter-suppressions: "$LINTER"
  no-type-suppressions: "false"
  no-runtime-suppressions: true
  no-compiler-suppressions: "true"
  typo-rule: false
`,
      { warn },
    );

    expect(config.builtInRules).toEqual({
      "no-linter-suppressions": false,
      "no-type-suppressions": false,
      "no-runtime-suppressions": true,
      "no-compiler-suppressions": true,
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("unknown built-in rule"));
  });

  test("invalid custom rules are skipped while later rules continue", () => {
    const warn = mock(() => {});
    const config = parseConfig(
      `
custom_rules:
  - id: ""
    name: "Bad"
    filePatterns: ["**/*.ts"]
    patterns: ["// Bad"]
    message: "bad"
  - id: "bad-regex"
    name: "Bad Regex"
    filePatterns: ["**/*.ts"]
    patterns: ["["]
    message: "bad"
  - id: 123
    name: "Bad Type"
    filePatterns: ["**/*.ts"]
    patterns: ["// Bad"]
    message: "bad"
  - id: "bad-file-pattern"
    name: "Bad File Pattern"
    filePatterns: [123]
    patterns: ["// Bad"]
    message: "bad"
  - id: "bad-pattern-type"
    name: "Bad Pattern Type"
    filePatterns: ["**/*.ts"]
    patterns: [123]
    message: "bad"
  - id: "good"
    name: "Good"
    filePatterns: ["**/*.ts"]
    patterns: ["// Good"]
    message: "good"
`,
      { warn },
    );

    expect(config.customRules.map((rule) => rule.id)).toEqual(["good"]);
    expect(warn).toHaveBeenCalled();
  });

  test("unresolved env refs in custom rules skip the rule and log", () => {
    const warn = mock(() => {});
    const config = parseConfig(
      `
custom_rules:
  - id: "$MISSING_RULE_ID"
    name: "Missing ID"
    filePatterns: ["**/*.ts"]
    patterns: ["// Missing"]
    message: "bad"
  - id: "missing-pattern"
    name: "Missing Pattern"
    filePatterns: ["**/*.ts"]
    patterns: ["$MISSING_PATTERN"]
    message: "bad"
  - id: "good"
    name: "Good"
    filePatterns: ["**/*.ts"]
    patterns: ["// Good"]
    message: "good"
`,
      { warn },
    );

    expect(config.customRules.map((rule) => rule.id)).toEqual(["good"]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("unresolved env ref"));
  });

  test("custom rule ids may collide with built-in ids and log a warning", () => {
    const warn = mock(() => {});
    const config = parseConfig(
      `
custom_rules:
  - id: "no-type-suppressions"
    name: "Project type suppressions"
    filePatterns: ["**/*.ts"]
    patterns: ["@ts-ignore"]
    message: "Use the project-specific fix."
`,
      { warn },
    );

    expect(config.customRules.map((rule) => rule.id)).toEqual(["no-type-suppressions"]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("overrides built-in rule"));
  });
});

describe("loadConfig", () => {
  test("missing YAML returns DEFAULT_CONFIG", () => {
    const warn = mock(() => {});

    expect(loadConfig(join(tmpdir(), "missing-llm-guardrails-config.yml"), { warn })).toBe(DEFAULT_CONFIG);
    expect(warn).not.toHaveBeenCalled();
  });

  test("reads YAML from disk", () => {
    const path = join(tmpdir(), `llm-guardrails-${Date.now()}.yml`);
    writeFileSync(path, "mode: off\n", "utf8");

    try {
      expect(loadConfig(path, { warn: mock(() => {}) }).mode).toBe("off");
    } finally {
      if (existsSync(path)) rmSync(path);
    }
  });
});
