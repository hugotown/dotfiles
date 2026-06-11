import { describe, expect, test } from "bun:test";
import * as path from "node:path";
import { buildRepoContext, renderRepoContext } from "../lib/repo-context.ts";

const repoRoot = path.resolve(import.meta.dir, "..");

describe("renderRepoContext", () => {
  test("empty context renders to empty string", () => {
    expect(renderRepoContext({ tree: "", stack: "", symbols: "" })).toBe("");
  });

  test("includes each non-empty section under the trust header", () => {
    const out = renderRepoContext({ tree: "t", stack: "s", symbols: "sym" });
    expect(out).toContain("Repository context (precomputed");
    expect(out).toContain("### Stack");
    expect(out).toContain("### File tree");
    expect(out).toContain("### Public symbols");
  });

  test("omits sections that are empty", () => {
    const out = renderRepoContext({ tree: "t", stack: "", symbols: "" });
    expect(out).toContain("### File tree");
    expect(out).not.toContain("### Stack");
    expect(out).not.toContain("### Public symbols");
  });
});

describe("buildRepoContext (integration, on this repo)", () => {
  test("never throws and returns three string sections", () => {
    const rc = buildRepoContext(repoRoot);
    expect(typeof rc.tree).toBe("string");
    expect(typeof rc.stack).toBe("string");
    expect(typeof rc.symbols).toBe("string");
  });

  test("stack reflects the package.json manifest", () => {
    expect(buildRepoContext(repoRoot).stack).toContain("package.json");
  });

  test("tree lists known directories when eza/find is available", () => {
    const { tree } = buildRepoContext(repoRoot);
    if (tree) expect(tree).toContain("lib");
  });

  test("symbol outline includes a known export when ast-grep is available", () => {
    const { symbols } = buildRepoContext(repoRoot);
    // Assert on an early, stable export: the outline is alphabetical and capped
    // (SYMBOLS_CAP), so a symbol from a late-sorting file (e.g. repo-context.ts)
    // may be truncated out as the codebase grows.
    if (symbols) expect(symbols).toContain("export function buildLevels");
  });
});
