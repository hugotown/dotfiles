// panel/input-editor.ts — Inline editor wrapper for user input in the panel.

export interface InlineEditorOpts {
  placeholder: string;
  onSubmit: (text: string) => void;
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
      const padded = hint.length >= width ? hint.slice(0, width) : hint + " ".repeat(width - hint.length);
      return [separator, padded];
    }
    const prompt = `> ${this.buffer}_`;
    const hint = "[Enter to send]";
    const line = prompt.length + hint.length >= width
      ? prompt.slice(0, width)
      : prompt + " ".repeat(width - prompt.length - hint.length) + hint;
    return [separator, line];
  }
}
