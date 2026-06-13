// panel/tests/input-editor.test.ts
import { describe, test, expect } from "bun:test";
import { InlineEditor } from "../input-editor.ts";

// Mock TUI that satisfies the Editor constructor
const mockTui = { requestRender: () => {} } as any;

describe("InlineEditor", () => {
  test("isActive returns false initially", () => {
    const editor = new InlineEditor({
      tui: mockTui,
      placeholder: "type here",
      onSubmit: () => {},
    });
    expect(editor.isActive()).toBe(false);
  });

  test("activate makes isActive true", () => {
    const editor = new InlineEditor({
      tui: mockTui,
      placeholder: "type here",
      onSubmit: () => {},
    });
    editor.activate();
    expect(editor.isActive()).toBe(true);
  });

  test("deactivate makes isActive false", () => {
    const editor = new InlineEditor({
      tui: mockTui,
      placeholder: "type here",
      onSubmit: () => {},
    });
    editor.activate();
    editor.deactivate();
    expect(editor.isActive()).toBe(false);
  });

  test("render returns placeholder line when inactive", () => {
    const editor = new InlineEditor({
      tui: mockTui,
      placeholder: "What is your name?",
      onSubmit: () => {},
    });
    const lines = editor.render(40);
    expect(lines.some((l) => l.includes("What is your name?"))).toBe(true);
  });

  test("setPlaceholder updates the display text", () => {
    const editor = new InlineEditor({
      tui: mockTui,
      placeholder: "old",
      onSubmit: () => {},
    });
    editor.setPlaceholder("new prompt");
    const lines = editor.render(40);
    expect(lines.some((l) => l.includes("new prompt"))).toBe(true);
  });
});
