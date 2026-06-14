// panel/tests/input-editor.test.ts
import { describe, test, expect } from "bun:test";
import { InlineEditor } from "../input-editor.ts";

describe("InlineEditor", () => {
  test("isActive returns false initially", () => {
    const editor = new InlineEditor({
      placeholder: "type here",
      onSubmit: () => {},
    });
    expect(editor.isActive()).toBe(false);
  });

  test("activate makes isActive true", () => {
    const editor = new InlineEditor({
      placeholder: "type here",
      onSubmit: () => {},
    });
    editor.activate();
    expect(editor.isActive()).toBe(true);
  });

  test("deactivate makes isActive false", () => {
    const editor = new InlineEditor({
      placeholder: "type here",
      onSubmit: () => {},
    });
    editor.activate();
    editor.deactivate();
    expect(editor.isActive()).toBe(false);
  });

  test("render returns placeholder line when inactive", () => {
    const editor = new InlineEditor({
      placeholder: "What is your name?",
      onSubmit: () => {},
    });
    const lines = editor.render(40);
    expect(lines.some((l) => l.includes("What is your name?"))).toBe(true);
  });

  test("setPlaceholder updates the display text", () => {
    const editor = new InlineEditor({
      placeholder: "old",
      onSubmit: () => {},
    });
    editor.setPlaceholder("new prompt");
    const lines = editor.render(40);
    expect(lines.some((l) => l.includes("new prompt"))).toBe(true);
  });

  test("active render shows the question and a clear answer field", () => {
    const editor = new InlineEditor({
      placeholder: "What is your name?",
      onSubmit: () => {},
    });
    editor.activate();
    const lines = editor.render(60);
    expect(lines.some((l) => l.includes("Question: What is your name?"))).toBe(true);
    expect(lines.some((l) => l.includes("Answer: > _"))).toBe(true);
    expect(lines.some((l) => l.includes("Enter to send"))).toBe(true);
  });

  test("active render wraps long and multiline questions", () => {
    const editor = new InlineEditor({
      placeholder: "First line\nSecond line with enough text to wrap clearly",
      onSubmit: () => {},
    });
    editor.activate();
    const lines = editor.render(30);
    expect(lines.some((l) => l.includes("Question: First line"))).toBe(true);
    expect(lines.some((l) => l.includes("Second line"))).toBe(true);
    expect(lines.length).toBeGreaterThan(4);
  });
});
