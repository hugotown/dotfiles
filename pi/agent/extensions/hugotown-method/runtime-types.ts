// runtime-types.ts — Runtime state and orchestration types.
import type { NodeDef } from "./types.ts";

export type NodeStatus =
  | "pending" | "running" | "completed" | "failed" | "skipped" | "cancelled" | "paused";
export type RunStatus = "running" | "completed" | "failed" | "cancelled" | "paused";

export interface NodeState {
  status: NodeStatus;
  output: string;
  structured?: unknown;
  started_at?: string;
  completed_at?: string;
  session_id?: string;
  attempts?: number;
  error?: string;
}

export interface RunState {
  id: string;
  workflow: string;
  arguments: string;
  status: RunStatus;
  worktree?: { branch: string; path: string };
  artifacts_dir: string;
  base_branch: string;
  started_at: string;
  completed_at?: string;
  paused_node?: string;
  nodes: Record<string, NodeState>;
}

export interface NodeResult {
  status: NodeStatus;
  output: string;
  structured?: unknown;
  sessionId?: string;
  error?: string;
}

export interface SubContext {
  builtins: Record<string, string>;
  nodeOutputs: Record<string, string>;
  nodeStructured: Record<string, unknown>;
}

export interface PiRunResult {
  output: string;
  status: "ok" | "failed";
  exitCode: number;
  stderr: string;
  sessionId?: string;
  stopReason?: string;
  errorMessage?: string;
  messages: unknown[];
}

export interface ExecResult { stdout: string; stderr: string; code: number; killed: boolean; }
export type ExecLike = (
  command: string,
  args: string[],
  options?: { signal?: AbortSignal; timeout?: number; cwd?: string },
) => Promise<ExecResult>;

export interface RunDeps {
  exec: ExecLike;
  notify: (msg: string, level?: "info" | "warning" | "error") => void;
  emit: (state: RunState) => void;
  progress?: (nodeId: string, text: string) => void;
  home: string;
  bundledDir: string;
  projectDir: string;
  signal?: AbortSignal;
  defaultModel?: string;
  defaultProvider?: string;
}

export interface RunCtx {
  node: NodeDef;
  state: RunState;
  deps: RunDeps;
  sub: SubContext;
  cwd: string;
}
