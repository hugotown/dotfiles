// panel/palette.ts — Status → hex color mapping (Tokyo Night palette).
import type { NodeStatus } from "../runtime-types.ts";

const COLORS: Record<NodeStatus, string> = {
  pending: "#565f89",
  running: "#e0af68",
  paused: "#bb9af7",
  completed: "#9ece6a",
  failed: "#f7768e",
  skipped: "#565f89",
  cancelled: "#565f89",
};

export function colorFor(status: NodeStatus): string {
  return COLORS[status];
}
