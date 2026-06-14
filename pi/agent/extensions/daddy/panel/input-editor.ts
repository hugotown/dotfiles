// panel/input-editor.ts — Inline editor wrapper for user input in the panel.

export interface InlineEditorOpts {
  placeholder: string;
  onSubmit: (text: string) => void;
}

function wrapText(text: string, width: number): string[] {
  if (width <= 0) return [];
  const lines: string[] = [];
  for (const raw of text.split("\n")) {
    let rest = raw;
    do {
      lines.push(rest.slice(0, width));
      rest = rest.slice(width);
    } while (rest.length > 0);
  }
  return lines;
}

function pad(line: string, width: number): string {
  return line.length >= width ? line.slice(0, width) : line + " ".repeat(width - line.length);
}

export class InlineEditor {
  private active = false;
  private placeholder: string;
  private buffer = "";
  private readonly onSubmit: (text: string) => void;

  constructor(opts: InlineEditorOpts) {
    this.placeholder = opts.placeholder;
    this.onSubmit = opts.onSubmit;
  }

  isActive(): boolean { return this.active; }
  activate(): void { this.active = true; this.buffer = ""; }
  deactivate(): void { this.active = false; this.buffer = ""; }
  setPlaceholder(text: string): void { this.placeholder = text; }
  destroy(): void { this.deactivate(); }

  handleInput(data: string): void {
    if (!this.active) return;
    if (data === "\r" || data === "\n") {
      if (this.buffer.trim()) {
        this.onSubmit(this.buffer.trim());
        this.buffer = "";
      }
      return;
    }
    if (data === "\x7f") { // backspace
      this.buffer = this.buffer.slice(0, -1);
      return;
    }
    if (data.length === 1 && data >= " ") {
      this.buffer += data;
    }
  }

  render(width: number): string[] {
    const separator = "─".repeat(width);
    if (!this.active) {
      const hint = `  ${this.placeholder}`;
      return [separator, pad(hint, width)];
    }
    const question = `Question: ${this.placeholder}`;
    const questionLines = wrapText(question, width).map((line) => pad(line, width));
    const prompt = `Answer: > ${this.buffer}_`;
    const hint = "[Enter to send]";
    const line = prompt.length + hint.length >= width
      ? prompt.slice(0, width)
      : prompt + " ".repeat(width - prompt.length - hint.length) + hint;
    return [separator, ...questionLines, line, separator];
  }
}
