// panel/component.ts — Main DaddyPanel Component (layout orchestrator).
import type { Component } from "@earendil-works/pi-tui";
import { Key, matchesKey } from "@earendil-works/pi-tui";
import type { Store } from "./store.ts";
import type { NodeState, RunDeps } from "../runtime-types.ts";
import type { StreamEntry } from "./store.ts";
import { renderNodeList } from "./node-list.ts";
import { renderStreamView, toLines } from "./stream-view.ts";
import { InlineEditor } from "./input-editor.ts";
import { resumeRun } from "../lib/run-controller.ts";

const TITLE = "Deterministic, Agentic-Driven Development — You Lead.";
const GAP = " │ ";

function pad(line: string, width: number): string {
  if (width <= 0) return "";
  return line.length >= width ? line.slice(0, width) : line + " ".repeat(width - line.length);
}

function visibleLength(line: string): number {
  return line.replace(/\x1b\[[0-9;]*m/g, "").length;
}

function padAnsi(line: string, width: number): string {
  const visible = visibleLength(line);
  return visible >= width ? line : line + " ".repeat(width - visible);
}

function wrapText(text: string, width: number): string[] {
  if (width <= 0) return [];
  const lines: string[] = [];
  for (const raw of text.split("\n")) {
    let rest = raw;
    while (rest.length > width) {
      lines.push(rest.slice(0, width));
      rest = rest.slice(width);
    }
    lines.push(rest);
  }
  return lines;
}

function topBorder(title: string, width: number): string {
  const inner = Math.max(0, width - 2);
  const label = ` ${title} `;
  const shown = label.length > inner ? label.slice(0, inner) : label;
  return `╭${shown}${"─".repeat(Math.max(0, inner - shown.length))}╮`;
}

function bottomBorder(width: number): string {
  return `╰${"─".repeat(Math.max(0, width - 2))}╯`;
}

function frameRow(content: string, width: number): string {
  return `│${padAnsi(content, Math.max(0, width - 2))}│`;
}

function fitEditorLines(lines: string[], height: number, width: number): string[] {
  if (height <= 0) return [];
  if (lines.length <= height) return lines.map((line) => pad(line, width));
  if (height === 1) return [pad(lines.find((line) => line.includes("Answer:")) ?? lines.at(-1) ?? "", width)];
  if (height === 2) return [pad(lines[0] ?? "", width), pad(lines.find((line) => line.includes("Answer:")) ?? lines.at(-1) ?? "", width)];

  const first = lines[0] ?? "";
  const answerIndex = lines.findIndex((line) => line.includes("Answer:"));
  const answer = answerIndex >= 0 ? lines[answerIndex] : lines.at(-2) ?? "";
  const last = lines.at(-1) ?? "";
  const questionBudget = Math.max(0, height - 3);
  const questionLines = lines.slice(1, Math.max(1, answerIndex >= 0 ? answerIndex : lines.length - 2)).slice(0, questionBudget);
  return [first, ...questionLines, answer, last].slice(0, height).map((line) => pad(line, width));
}

function emptyStateMessage(node: NodeState | undefined): string {
  switch (node?.status) {
    case "pending": return "Waiting to start…";
    case "running": return "Streaming…";
    case "paused": return "Awaiting input…";
    case "failed": return node.error ? `Failed: ${node.error}` : "Failed";
    case "skipped": return "Skipped";
    case "cancelled": return "Cancelled";
    case "completed": return "(no output captured)";
    default: return "No output yet";
  }
}

function actionHint(status: string | undefined): string {
  switch (status) {
    case "paused": return "Actions: approve | reject | cancel";
    case "failed": return "Actions: status | retry | recover | cancel";
    case "completed": return "Actions: status | merge/remove if worktree";
    case "running": return "Actions: status | cancel";
    default: return "Actions: status";
  }
}

function emptyStateFor(node: NodeState | undefined, width: number, height: number): string[] {
  const msg = node?.status === "paused" && node.output
    ? `Question: ${node.output}\nAwaiting your answer below.`
    : emptyStateMessage(node);
  const rows: string[] = [];
  for (let i = 0; i < Math.max(0, height); i++) rows.push(" ".repeat(width));
  if (rows.length > 0) {
    const messages = wrapText(msg, width);
    const start = Math.max(0, Math.floor(rows.length / 2) - Math.floor(messages.length / 2));
    for (let i = 0; i < messages.length && start + i < rows.length; i++) {
      const line = messages[i];
      rows[start + i] = line.length >= width ? line.slice(0, width) : line + " ".repeat(width - line.length);
    }
  }
  return rows;
}

export interface DaddyPanelOpts {
  store: Store;
  deps: RunDeps;
  done: () => void;
  requestRender: () => void;
  height?: number;
}

export class DaddyPanel implements Component {
  private selected = 0;
  private scrollOffset = 0;
  private userNavigated = false;
  private lastRunId: string | null = null;
  private readonly height: number;
  private unsubscribe: () => void;
  private editor: InlineEditor;
  private readonly store: Store;
  private readonly deps: RunDeps;
  private readonly done: () => void;
  private readonly requestRender: () => void;

  constructor(opts: DaddyPanelOpts) {
    this.store = opts.store;
    this.deps = opts.deps;
    this.done = opts.done;
    this.requestRender = opts.requestRender;
    this.height = opts.height ?? Math.max(6, Math.floor((process.stdout.rows ?? 24) * 0.7));
    this.editor = new InlineEditor({
      placeholder: "",
      onSubmit: (text) => this.submitInput(text),
    });
    this.unsubscribe = this.store.subscribe(() => {
      this.syncAutoNav();
      this.requestRender();
    });
    this.syncAutoNav();
  }

  private syncAutoNav(): void {
    const { waitingForInput, inputPrompt, run } = this.store.getState();
    const nodes = this.getNodeEntries();
    if (run && run.id !== this.lastRunId) {
      this.lastRunId = run.id;
      this.selected = 0;
      this.scrollOffset = 0;
      this.userNavigated = false;
    }
    if (this.selected >= nodes.length) this.selected = Math.max(0, nodes.length - 1);
    if (waitingForInput) {
      const idx = nodes.findIndex((n) => n.id === waitingForInput);
      if (idx >= 0) this.selected = idx;
      this.editor.setPlaceholder(inputPrompt ?? "");
      this.editor.activate();
      this.userNavigated = true;
      return;
    }
    this.editor.deactivate();
    if (!this.userNavigated && run) {
      const runningIdx = nodes.findIndex((n) => n.status === "running");
      if (runningIdx >= 0) this.selected = runningIdx;
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
    if (this.editor.isActive()) { this.editor.handleInput(data); this.requestRender(); return; }
    if (matchesKey(data, Key.pageUp)) { this.scrollOffset += 1; this.requestRender(); return; }
    if (matchesKey(data, Key.pageDown)) { this.scrollOffset = Math.max(0, this.scrollOffset - 1); this.requestRender(); return; }
    if (matchesKey(data, Key.up)) {
      this.selected = Math.max(0, this.selected - 1);
      this.scrollOffset = 0;
      this.userNavigated = true;
      this.requestRender();
    } else if (matchesKey(data, Key.down)) {
      const max = this.getNodeEntries().length - 1;
      this.selected = Math.min(max, this.selected + 1);
      this.scrollOffset = 0;
      this.userNavigated = true;
      this.requestRender();
    }
  }

  render(width: number): string[] {
    const height = Math.max(6, this.height);
    const bodyHeight = Math.max(0, height - 2);
    const contentWidth = Math.max(1, width - 2);
    const leftWidth = Math.min(24, Math.floor(contentWidth * 0.3));
    const rightWidth = Math.max(1, contentWidth - leftWidth - GAP.length);
    const nodes = this.getNodeEntries();
    const selectedNodeId = nodes[this.selected]?.id;
    const state = this.store.getState();
    const selectedNode = selectedNodeId ? state.run?.nodes[selectedNodeId] : undefined;
    const selectedModel = selectedNode?.model ?? "n/a";
    const history = selectedNodeId ? (state.streams[selectedNodeId] ?? []) : [];
    const liveText = selectedNodeId ? state.live[selectedNodeId] : undefined;
    const streams = liveText
      ? [...history, { type: "text" as const, content: liveText, timestamp: 0 }]
      : history;
    const editorLines = this.editor.isActive() ? this.editor.render(rightWidth) : [];
    const headerRows = bodyHeight > 0 ? 1 : 0;
    const contentRows = Math.max(0, bodyHeight - headerRows);
    const maxEditorRows = editorLines.length > 0 ? Math.max(5, Math.floor(contentRows * 0.35)) : 0;
    const editorRows = Math.min(editorLines.length, maxEditorRows, contentRows);
    const streamAreaRows = Math.max(0, contentRows - editorRows);
    const bottomGutterRows = editorRows === 0 && streamAreaRows > 2 ? 1 : 0;
    const streamHeight = Math.max(0, streamAreaRows - bottomGutterRows);
    const left = renderNodeList(nodes, this.selected, leftWidth, contentRows);
    const allStreamLines = toLines(streams, rightWidth);
    const maxOffset = Math.max(0, allStreamLines.length - streamHeight);
    this.scrollOffset = Math.min(Math.max(0, this.scrollOffset), maxOffset);
    let right: string[];
    if (streams.length === 0 && selectedNodeId) {
      if (selectedNode?.status !== "paused" && selectedNode?.output) {
        const fallbackEntries: StreamEntry[] = [];
        if (selectedNode.thinking) fallbackEntries.push({ type: "thinking", content: selectedNode.thinking, timestamp: 0 });
        fallbackEntries.push({ type: "text", content: selectedNode.output, timestamp: 0 });
        right = renderStreamView(fallbackEntries, rightWidth, streamHeight, 0);
      } else {
        right = emptyStateFor(selectedNode, rightWidth, streamHeight);
      }
    } else {
      right = renderStreamView(streams, rightWidth, streamHeight, this.scrollOffset);
      if (this.scrollOffset < maxOffset && right.length > 0) {
        right[right.length - 1] = right[right.length - 1].slice(0, Math.max(0, rightWidth - 8)) + "\x1b[33m↓ more\x1b[39m";
      }
      if (this.scrollOffset > 0 && right.length > 0) {
        right[0] = right[0].slice(0, Math.max(0, rightWidth - 7)) + "\x1b[33m↑ top\x1b[39m";
      }
    }
    const fittedEditor = fitEditorLines(editorLines, editorRows, rightWidth);
    const rows: string[] = [topBorder(TITLE, width)];
    if (headerRows > 0) {
      rows.push(frameRow(pad("Nodes", leftWidth) + GAP + pad(`Output: ${selectedNodeId ?? "none"} · Model: ${selectedModel} · ${actionHint(state.run?.status)}`, rightWidth), width));
    }
    for (let i = 0; i < contentRows; i++) {
      const l = left[i] ?? " ".repeat(leftWidth);
      const r = i < streamHeight
        ? (right[i] ?? "")
        : i < streamAreaRows
          ? ""
          : (fittedEditor[i - streamAreaRows] ?? "");
      rows.push(frameRow(padAnsi(l, leftWidth) + GAP + padAnsi(r, rightWidth), width));
    }
    while (rows.length < height - 1) rows.push(frameRow("", width));
    rows.push(bottomBorder(width));
    return rows;
  }

  invalidate(): void {}
  dispose(): void { this.unsubscribe(); this.editor.destroy(); }
}
