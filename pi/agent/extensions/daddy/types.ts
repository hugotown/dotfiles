// SDK-free shared types so validation/scheduling can be unit-tested in isolation.

export type Action = "bash" | "flag" | "ask" | "llm";
export type Status = "pending" | "running" | "ok" | "failed" | "skipped";
export type Variant = "low" | "medium" | "high";

/** One authored question for a deterministic (aiAssisted:false) ask node. */
export interface AskQuestion {
	id: string;
	type: "select" | "text";
	label: string;
	options?: string[];
	default?: string;
	reasoning?: string;
}

/** A node as authored in YAML (design-time). depends_on is normalized to [] on load. */
export interface WorkflowNode {
	id: string;
	action: Action;
	aiAssisted: boolean;
	depends_on: string[];
	command?: string; // bash
	flag?: string; // flag
	args?: string; // flag
	questions?: AskQuestion[]; // ask, aiAssisted:false
	prompt?: string; // ask aiAssisted:true | llm
	provider?: string; // llm
	model?: string; // llm
	variant?: Variant; // llm
	instructions?: string; // llm
	provides?: string; // documentation only (design §17.1)
	output_schema?: Record<string, unknown>; // llm optional
}

export interface SipocChain {
	sipoc: string;
	supplier?: string;
	customer?: string;
	nodes: WorkflowNode[];
}

export interface Workflow {
	name: string;
	description?: string;
	vsm: SipocChain[];
}

/** Runtime node = authored node + execution status/output. */
export interface NodeState extends WorkflowNode {
	status: Status;
	output?: string;
	structured?: unknown;
	startedAt?: string;
	endedAt?: string;
}

export interface SipocState {
	sipoc: string;
	nodes: NodeState[];
}

export interface StateMachine {
	workflow: string;
	arguments: string;
	startedAt: string;
	pid: number;
	heartbeat: string;
	vsm: SipocState[];
}

/** Uniform return of a self-contained node executor. */
export interface NodeResult {
	status: "ok" | "failed";
	output: string;
	structured?: unknown;
}
