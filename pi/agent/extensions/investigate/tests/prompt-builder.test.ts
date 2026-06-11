import { describe, expect, test } from "bun:test";
import { extractFindings } from "../lib/prompt-builder.ts";

describe("extractFindings", () => {
  test("matches bare FINDINGS: marker", () => {
    const out = extractFindings("Some prose.\n\nFINDINGS:\nThe answer is X.");
    expect(out).toBe("FINDINGS:\nThe answer is X.");
  });

  test("matches **FINDINGS:** wrapped in bold", () => {
    const out = extractFindings("Some prose.\n\n**FINDINGS:**\nThe answer is X.");
    expect(out).toBe("FINDINGS:\nThe answer is X.");
  });

  test("matches ## FINDINGS heading", () => {
    const out = extractFindings("Some prose.\n\n## FINDINGS\nThe answer is X.");
    expect(out).toBe("FINDINGS:\nThe answer is X.");
  });

  test("matches ### Findings: heading", () => {
    const out = extractFindings("Some prose.\n\n### Findings:\nThe answer is X.");
    expect(out).toBe("FINDINGS:\nThe answer is X.");
  });

  test("matches lowercase findings: marker", () => {
    const out = extractFindings("Some prose.\n\nfindings:\nThe answer is X.");
    expect(out).toBe("FINDINGS:\nThe answer is X.");
  });

  test("returns null when no marker is present", () => {
    expect(extractFindings("Just some prose without any marker.")).toBeNull();
  });

  test("returns null when marker is present but body is empty", () => {
    expect(extractFindings("Some prose.\n\nFINDINGS:\n\n")).toBeNull();
  });

  test("preserves multi-line body verbatim", () => {
    const body = "Line one.\n\nLine two with [cite](https://example.com).";
    const out = extractFindings(`Pre.\n\nFINDINGS:\n${body}`);
    expect(out).toBe(`FINDINGS:\n${body}`);
  });

  test("ignores inline FINDINGS: mentions inside prose (text before marker on same line)", () => {
    // The marker regex requires the marker to be alone on its line, so the
    // mention "Intro mentioning FINDINGS:." (which has prose before FINDINGS:)
    // is correctly skipped and only the real section is captured.
    const out = extractFindings("Intro mentioning FINDINGS:.\n\nMore prose.\n\nFINDINGS:\nReal answer.");
    expect(out).toBe("FINDINGS:\nReal answer.");
  });

  test("ignores 'findings' as a word inside prose", () => {
    // "the findings show that X" should not be confused with a marker.
    const out = extractFindings("Some prose where the findings show that X is plausible.\n\nFINDINGS:\nReal answer.");
    expect(out).toBe("FINDINGS:\nReal answer.");
  });

  test("picks the LAST marker when the sub-pi echoes the marker earlier", () => {
    // A model might write a marker line earlier (e.g. to acknowledge the rule)
    // and then emit the real one at the end. We want the final section.
    const text = "FINDINGS:\nDraft sketch.\n\nMore reasoning here.\n\nFINDINGS:\nFinal answer.";
    const out = extractFindings(text);
    expect(out).toBe("FINDINGS:\nFinal answer.");
  });
});
