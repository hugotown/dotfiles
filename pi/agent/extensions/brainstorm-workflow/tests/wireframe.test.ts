// tests/wireframe.test.ts
import { describe, expect, test } from "bun:test";
import { renderWireframe } from "../lib/wireframe.ts";

describe("renderWireframe", () => {
  test("replaces color tags with theme calls", () => {
    const lines = [
      "{{accent}}Header{{/accent}}",
      "{{muted}}Some muted text{{/muted}}",
      "Plain text no tags",
    ];

    const theme = {
      fg: (color: string, text: string) => `[${color}:${text}]`,
      bold: (text: string) => `<b>${text}</b>`,
    };

    const result = renderWireframe(lines, theme as any);
    expect(result[0]).toBe("[accent:Header]");
    expect(result[1]).toBe("[muted:Some muted text]");
    expect(result[2]).toBe("Plain text no tags");
  });

  test("handles bold tag", () => {
    const lines = ["{{bold}}Title{{/bold}}"];
    const theme = {
      fg: (color: string, text: string) => `[${color}:${text}]`,
      bold: (text: string) => `<b>${text}</b>`,
    };

    const result = renderWireframe(lines, theme as any);
    expect(result[0]).toBe("<b>Title</b>");
  });

  test("handles multiple tags in one line", () => {
    const lines = ["{{accent}}Name{{/accent}} - {{muted}}desc{{/muted}}"];
    const theme = {
      fg: (color: string, text: string) => `[${color}:${text}]`,
      bold: (text: string) => `<b>${text}</b>`,
    };

    const result = renderWireframe(lines, theme as any);
    expect(result[0]).toBe("[accent:Name] - [muted:desc]");
  });
});
