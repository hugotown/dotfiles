// panel/icons.ts — Node state → icon mapping. All glyphs are ASCII/Latin-1 so they
// render in every monospace font (Tokyo Night, JetBrains Mono, Fira, etc.).
// Visual differentiation leans on the colored background from palette.ts.
import type { NodeStatus } from "../runtime-types.ts";

export type NodeIcon = "·" | ">" | "?" | "+" | "!" | "~" | "x";

const ICONS: Record<NodeStatus, NodeIcon> = {
  pending: "·",
  running: ">",
  paused: "?",
  completed: "+",
  failed: "!",
  skipped: "~",
  cancelled: "x",
};

export function iconFor(status: NodeStatus): NodeIcon {
  return ICONS[status];
}
