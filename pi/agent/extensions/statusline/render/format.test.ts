import { expect, test } from "bun:test";
import { activeIcons } from "./format";

test("uses emoji capability indicators and omits generic files when image/pdf exist", () => {
  const icons = activeIcons({
    id: "gpt-5.5",
    name: "GPT-5.5",
    attachment: true,
    modalities: { input: ["image", "pdf"] },
    reasoning: true,
    tool_call: true,
  });

  expect(icons).toEqual(["📝", "🖼️", "📄", "🧠", "🔧"]);
});

test("shows generic files only when attachments exist without image/pdf", () => {
  const icons = activeIcons({
    id: "claude-x",
    name: "Claude X",
    attachment: true,
    modalities: { input: [] },
  });

  expect(icons).toEqual(["📝", "📎"]);
});
