import { describe, expect, test } from "bun:test";
import { deriveContracts } from "../phases/plan/contracts.ts";

describe("deriveContracts (fallback)", () => {
  test("pulls Create/Modify/Test paths, dedupes, strips line ranges", () => {
    const plan = [
      "**Files:**",
      "- Create: `packages/db/src/models/x.model.ts`",
      "- Modify: `packages/api/src/routers/index.ts:10-20`",
      "- Test: `tests/x.test.ts`",
      "later again Create: `packages/db/src/models/x.model.ts`",
    ].join("\n");
    const paths = deriveContracts(plan).map((c) => c.path);
    expect(paths).toContain("packages/db/src/models/x.model.ts");
    expect(paths).toContain("packages/api/src/routers/index.ts");
    expect(paths).toContain("tests/x.test.ts");
    expect(paths.filter((p) => p === "packages/db/src/models/x.model.ts")).toHaveLength(1);
  });

  test("empty when there are no file lines", () => {
    expect(deriveContracts("just prose, no files")).toEqual([]);
  });
});
