import { describe, expect, test } from "bun:test";
import { scan } from "../lib/scanner.ts";
import type { Rule } from "../lib/types.ts";
import { BUILT_IN_RULES } from "../rules/built-in.ts";

describe("scan", () => {
  test("matches canonical built-in suppression directives", () => {
    const cases: Array<[string, string, string]> = [
      ["foo.ts", "// eslint-disable-next-line", "no-linter-suppressions"],
      ["foo.ts", "// eslint-disable-next-line react-hooks/exhaustive-deps", "no-linter-suppressions"],
      ["foo.ts", "/* eslint-disable */", "no-linter-suppressions"],
      ["foo.ts", "// @ts-ignore", "no-type-suppressions"],
      ["foo.ts", "// @ts-nocheck", "no-type-suppressions"],
      ["foo.ts", "// @ts-expect-error", "no-type-suppressions"],
      ["foo.ts", "// @bun-ignore", "no-runtime-suppressions"],
      ["foo.go", "//nolint", "no-runtime-suppressions"],
      ["foo.go", "//nolint:all", "no-runtime-suppressions"],
      ["foo.py", "# noqa", "no-runtime-suppressions"],
      ["foo.py", "# type: ignore", "no-type-suppressions"],
      ["Foo.java", '@SuppressWarnings("unchecked")', "no-compiler-suppressions"],
      ["Foo.java", '// @SuppressWarnings("unchecked")', "no-compiler-suppressions"],
      ["foo.cs", "#pragma warning disable 414", "no-compiler-suppressions"],
      ["foo.c", '#pragma GCC diagnostic ignored "-Wunused"', "no-compiler-suppressions"],
      ["foo.css", "/* stylelint-disable */", "no-linter-suppressions"],
      ["foo.php", "// @phpstan-ignore-line", "no-linter-suppressions"],
      ["foo.php", "// @psalm-suppress PropertyNotSetInConstructor", "no-linter-suppressions"],
      ["foo.rb", "# rubocop:disable Style/Documentation", "no-linter-suppressions"],
    ];

    for (const [file, content, ruleId] of cases) {
      expect(scan(file, content, BUILT_IN_RULES).map((match) => match.ruleId)).toContain(ruleId);
    }
  });

  test("matches common evasion variants", () => {
    const cases = [
      "//   eslint-disable",
      "// ESLINT-DISABLE",
      "//EsLint-Disable-next-Line",
      "/*eslint-disable*/",
      "/* eslint-disable react-hooks/exhaustive-deps */",
    ];

    for (const content of cases) {
      expect(scan("foo.ts", content, BUILT_IN_RULES)).toHaveLength(1);
    }
  });

  test("avoids prose, URLs, and string literals", () => {
    const content = [
      "// I disabled the lint warning",
      "// this is a comment about eslint-disable, not using it",
      'const x = "// eslint-disable";',
      "const y = '/* eslint-disable */';",
      "const z = `// @ts-ignore`;",
      "https://eslint-disable-docs.com",
    ].join("\n");

    expect(scan("foo.ts", content, BUILT_IN_RULES)).toEqual([]);
  });

  test("filters rules by filePatterns", () => {
    const rule: Rule = {
      id: "only-ts",
      name: "Only TS",
      filePatterns: ["**/*.ts"],
      patterns: [/\/\/\s*NOPE/g],
      message: "nope",
    };

    expect(scan("foo.py", "// NOPE", [rule])).toEqual([]);
    expect(scan("foo.ts", "// NOPE", [rule])).toHaveLength(1);
  });

  test("returns multiple matches sorted by line and column", () => {
    const matches = scan("foo.ts", "ok\n// @ts-ignore\n  // eslint-disable-next-line\n// @bun-ignore", BUILT_IN_RULES);

    expect(matches.map((match) => [match.ruleId, match.line, match.column])).toEqual([
      ["no-type-suppressions", 2, 1],
      ["no-linter-suppressions", 3, 3],
      ["no-runtime-suppressions", 4, 1],
    ]);
  });

  test("returns one-based line and column for a match at line 42 column 13", () => {
    const content = `${Array.from({ length: 41 }, () => "ok").join("\n")}\n            // @ts-ignore`;
    const matches = scan("foo.ts", content, BUILT_IN_RULES);

    expect(matches.map((match) => [match.ruleId, match.line, match.column])).toEqual([
      ["no-type-suppressions", 42, 13],
    ]);
  });

  test("detects same-line real comments after mixed quote string literals", () => {
    const matches = scan("foo.ts", `const quote = '"'; // @ts-ignore`, BUILT_IN_RULES);

    expect(matches.map((match) => [match.ruleId, match.line, match.column])).toEqual([
      ["no-type-suppressions", 1, 20],
    ]);
  });

  test("keeps position calculation fast across many matches", () => {
    const content = Array.from({ length: 5000 }, (_, index) => `const value${index} = ${index}; // @ts-ignore`).join("\n");
    const started = performance.now();
    const matches = scan("foo.ts", content, BUILT_IN_RULES);

    expect(matches).toHaveLength(5000);
    expect(matches.at(-1)).toMatchObject({ line: 5000, column: 25 });
    expect(performance.now() - started).toBeLessThan(250);
  });

  test("scans a one megabyte file with a match at the end quickly", () => {
    const content = `${"x".repeat(1024 * 1024)}\n// @ts-ignore`;
    const started = performance.now();
    const matches = scan("foo.ts", content, BUILT_IN_RULES);

    expect(matches).toHaveLength(1);
    expect(performance.now() - started).toBeLessThan(100);
  });
});
