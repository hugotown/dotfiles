// panel/node-list.ts — Left column: node tree renderer with windowed scrolling.
import type { NodeStatus } from "../runtime-types.ts";
import { iconFor, colorFor } from "./icons.ts";

export interface NodeEntry {
  id: string;
  status: NodeStatus;
}

function windowStart(selected: number, count: number, height: number): number {
  return Math.max(0, Math.min(selected - Math.floor(height / 2), Math.max(0, count - height)));
}

function pad(text: string, width: number): string {
  if (text.length > width) return `${text.slice(0, Math.max(0, width - 1))}…`;
  return text + " ".repeat(width - text.length);
}

export function renderNodeList(
  nodes: NodeEntry[],
  selectedIndex: number,
  width: number,
  height: number,
): string[] {
  const start = windowStart(selectedIndex, nodes.length, height);
  const lines: string[] = [];
  for (let i = 0; i < height; i++) {
    const idx = start + i;
    const node = nodes[idx];
    if (!node) { lines.push(" ".repeat(width)); continue; }
    const marker = idx === selectedIndex ? ">" : " ";
    const icon = iconFor(node.status);
    lines.push(pad(`${marker} ${icon} ${node.id}`, width));
  }
  return lines;
}
