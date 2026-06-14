// types.ts — Workflow and node DEFINITION types (parsed from YAML).
export type NodeType = "prompt" | "command" | "bash" | "script" | "loop" | "interview" | "approval" | "cancel";
export type TriggerRule = "all_success" | "one_success" | "all_done" | "none_failed_min_one_success";
export type ContextMode = "fresh" | "shared";
export type Thinking = "low" | "medium" | "high";

export interface JsonSchema {
  type: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  enum?: string[];
  items?: JsonSchema;
}

export interface RetryConfig {
  max_attempts?: number;
  delay_ms?: number;
  on_error?: "transient" | "all";
}

export interface LoopSpec {
  prompt: string;
  until?: string;
  until_bash?: string;
  max_iterations: number;
  fresh_context?: boolean;
}

export interface InterviewSpec {
  prompt: string;
  until?: string;
  max_iterations: number;
}

export interface ApprovalSpec {
  message: string;
  capture_response?: boolean;
  on_reject?: "abort" | "retry";
}

export interface ScriptSpec {
  inline?: string;
  file?: string;
  runtime?: "bun" | "uv";
  deps?: string[];
  timeout?: number;
}

export interface NodeDef {
  id: string;
  depends_on?: string[];
  when?: string;
  trigger_rule?: TriggerRule;
  context?: ContextMode;
  model?: string;
  provider?: string;
  thinking?: Thinking;
  output_format?: JsonSchema;
  allowed_tools?: string[];
  denied_tools?: string[];
  retry?: RetryConfig;
  always_run?: boolean;
  timeout?: number;
  prompt?: string;
  command?: string;
  bash?: string;
  script?: ScriptSpec;
  loop?: LoopSpec;
  interview?: InterviewSpec;
  approval?: ApprovalSpec;
  cancel?: string;
}

export interface WorkflowDef {
  name: string;
  description: string;
  worktree?: boolean;
  model?: string;
  provider?: string;
  concurrency?: number;
  persist_sessions?: boolean;
  nodes: NodeDef[];
}
