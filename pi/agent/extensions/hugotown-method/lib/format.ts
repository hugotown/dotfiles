// lib/format.ts — Status icons + duration formatting for inline rendering.
import type { NodeStatus } from "../runtime-types.ts";

const ICONS: Record<NodeStatus, string> = {
  pending: "○", running: "◐", completed: "✓",
  failed: "✗", skipped: "–", cancelled: "⊘", paused: "⏸",
};

export function statusIcon(s: NodeStatus): string { return ICONS[s] ?? "?"; }

export function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  return `${Math.floor(sec / 60)}m${Math.round(sec % 60)}s`;
}
