import { describe, expect, test } from "bun:test";
import { extractJsonBlock, extractStatus } from "../lib/json-extract.ts";

describe("extractJsonBlock", () => {
  test("parses a fenced ```json block", () => {
    expect(extractJsonBlock<Array<{ a: number }>>("text\n```json\n[{\"a\":1}]\n```\n")).toEqual([{ a: 1 }]);
  });

  test("parses bare JSON", () => {
    expect(extractJsonBlock<{ a: number }>('{"a":2}')).toEqual({ a: 2 });
  });

  test("parses JSON embedded in surrounding prose", () => {
    expect(extractJsonBlock<number[]>("blah [1,2,3] end")).toEqual([1, 2, 3]);
  });

  test("returns null when there is no JSON", () => {
    expect(extractJsonBlock("nothing here")).toBeNull();
  });
});

describe("extractStatus", () => {
  test("finds an explicit STATUS token", () => {
    expect(extractStatus("work done\nSTATUS: BLOCKED")).toBe("BLOCKED");
  });

  test("is case-insensitive and upper-cases", () => {
    expect(extractStatus("status: done")).toBe("DONE");
  });

  test("defaults to DONE when absent", () => {
    expect(extractStatus("no marker present")).toBe("DONE");
  });
});
