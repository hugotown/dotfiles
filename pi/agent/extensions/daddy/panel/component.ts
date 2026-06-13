// panel/component.ts — Main DaddyPanel Component (layout orchestrator).
import type { Component } from "@earendil-works/pi-tui";
import { Key, matchesKey } from "@earendil-works/pi-tui";
import type { Store } from "./store.ts";
import type { RunDeps } from "../runtime-types.ts";
import { renderNodeList } from "./node-list.ts";
import { renderStreamView } from "./stream-view.ts";
import { InlineEditor } from "./input-editor.ts";
import { resumeRun } from "../lib/run-controller.ts";

const TITLE = "Deterministic, Agentic-Driven Development — You Lead.";
const GAP = " │ ";

export interface DaddyPanelOpts {
  store: Store;
  deps: RunDeps;
  done: () => void;
  requestRender: () => void;
}

export class DaddyPanel implements Component {
  private selected = 0;
  private unsubscribe: () => void;
  private editor: InlineEditor;
  private readonly store: Store;
  private readonly deps: RunDeps;
  private readonly done: () => void;

  constructor(opts: DaddyPanelOpts) {
    this.store = opts.store;
    this.deps = opts.deps;
    this.done = opts.done;
    this.editor = new InlineEditor({
      tui: {} as any,
      placeholder: "",
      onSubmit: (text) => this.submitInput(text),
    });
    this.unsubscribe = this.store.subscribe(() => {
      this.syncAutoNav();
      opts.requestRender();
    });
  }

  private syncAutoNav(): void {
    const { waitingForInput, inputPrompt } = this.store.getState();
    if (waitingForInput) {
      const nodes = this.getNodeEntries();
      const idx = nodes.findIndex((n) => n.id === waitingForInput);
      if (idx >= 0) this.selected = idx;
      this.editor.setPlaceholder(inputPrompt ?? "");
      this.editor.activate();
    } else {
      this.editor.deactivate();
    }
  }

  private getNodeEntries() {
    const run = this.store.getState().run;
    if (!run) return [];
    return Object.entries(run.nodes).map(([id, n]) => ({ id, status: n.status }));
  }

  private async submitInput(text: string): Promise<void> {
    const { run, waitingForInput } = this.store.getState();
    if (!run || !waitingForInput) return;
    this.editor.deactivate();
    await resumeRun(run.id, this.deps, { decision: "approve", comment: text });
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape)) { this.done(); return; }
    if (this.editor.isActive()) { this.editor.handleInput(data); return; }
    if (matchesKey(data, Key.up)) this.selected = Math.max(0, this.selected - 1);
    else if (matchesKey(data, Key.down)) {
      const max = this.getNodeEntries().length - 1;
      this.selected = Math.min(max, this.selected + 1);
    }
  }

  render(width: number): string[] {
    const height = Math.max(6, Math.floor((process.stdout.rows ?? 24) * 0.7));
    const leftWidth = Math.min(24, Math.floor(width * 0.3));
    const rightWidth = Math.max(1, width - leftWidth - GAP.length);
    const nodes = this.getNodeEntries();
    const selectedNodeId = nodes[this.selected]?.id;
    const state = this.store.getState();
    const history = selectedNodeId ? (state.streams[selectedNodeId] ?? []) : [];
    const liveText = selectedNodeId ? state.live[selectedNodeId] : undefined;
    const streams = liveText
      ? [...history, { type: "text" as const, content: liveText, timestamp: 0 }]
      : history;
    const editorLines = this.editor.isActive() ? this.editor.render(rightWidth) : [];
    const streamHeight = height - editorLines.length;
    const left = renderNodeList(nodes, this.selected, leftWidth, height);
    const right = renderStreamView(streams, rightWidth, streamHeight);
    const title = TITLE.length >= width ? TITLE.slice(0, width) : TITLE + " ".repeat(width - TITLE.length);
    const rows = [title];
    for (let i = 0; i < height; i++) {
      const l = left[i] ?? " ".repeat(leftWidth);
      const r = i < streamHeight ? (right[i] ?? "") : (editorLines[i - streamHeight] ?? "");
      rows.push(l + GAP + r);
    }
    return rows;
  }

  invalidate(): void {}
  dispose(): void { this.unsubscribe(); this.editor.destroy(); }
}
