import { describe, expect, test } from "bun:test";
import { progressLine } from "../lib/progress.ts";

describe("progress line", () => {
  test("prefixes the icon when present", () => {
    expect(progressLine({ icon: "🧠", text: "preguntando…" })).toBe("🧠 preguntando…");
  });

  test("plain text when no icon", () => {
    expect(progressLine({ text: "redactando el spec…" })).toBe("redactando el spec…");
  });
});
