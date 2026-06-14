// panel/node-list.ts — Left column: node tree renderer with windowed scrolling.
import type { NodeStatus } from "../runtime-types.ts";
import { iconFor } from "./icons.ts";
import { colorFor } from "./palette.ts";

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

function paintFg(hex: string, text: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `\x1b[38;2;${r};${g};${b}m${text}\x1b[39m`;
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
    const plain = pad(`${marker} ${icon} ${node.id}`, width);
    lines.push(paintFg(colorFor(node.status), plain));
  }
  return lines;
}
