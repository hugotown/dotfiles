// panel/icons.ts — Node state → icon and color mapping.
import type { NodeStatus } from "../runtime-types.ts";

export type NodeIcon = "○" | "●" | "◉" | "✓" | "✗" | "⊘";

const ICONS: Record<NodeStatus, NodeIcon> = {
  pending: "○",
  running: "●",
  paused: "◉",
  completed: "✓",
  failed: "✗",
  skipped: "⊘",
  cancelled: "⊘",
};

const COLORS: Record<NodeStatus, string> = {
  pending: "#565f89",
  running: "#e0af68",
  paused: "#bb9af7",
  completed: "#9ece6a",
  failed: "#f7768e",
  skipped: "#565f89",
  cancelled: "#565f89",
};

export function iconFor(status: NodeStatus): NodeIcon {
  return ICONS[status];
}

export function colorFor(status: NodeStatus): string {
  return COLORS[status];
}
