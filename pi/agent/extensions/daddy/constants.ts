// Centralized magic values so handlers/executors stay DRY.

/** Set in the child pi spawned for an llm node; flips index.ts into child mode. */
export const DADDY_NODE_ENV = "DADDY_NODE";

/** Child env: the node id the child must produce output for (append_node validation). */
export const DADDY_NODE_ID_ENV = "DADDY_NODE_ID";

/** Child env: the node's output_schema as JSON (empty string when none). */
export const DADDY_NODE_SCHEMA_ENV = "DADDY_NODE_SCHEMA";

/** Main execution flag and its namespaced modifiers (design §12.3). */
export const FLAG_WORKFLOW = "--daddy-workflow";
export const FLAG_FRESH = "--daddy-fresh";
export const FLAG_DESIGN = "--daddy-design";

/** Max parallel self-contained nodes within a wave. */
export const WAVE_CONCURRENCY = 4;

/** Cap append_node retries so an unsatisfiable output_schema fails the node (design §8). */
export const MAX_APPEND_ATTEMPTS = 5;

/** Custom message the child emits with the validated node result (display:false). */
export const NODE_RESULT_TYPE = "daddy-node-result";

/** Hidden marker injected before an AI-ask delegation; the context filter trims to it. */
export const ASK_MARKER = "daddy-ask-marker";

/** Workflow YAML lives here, project-local (design §3 non-goals). */
export const WORKFLOW_DIR = ".pi/daddy/workflows";

/** State file suffix; the file is named <workflow>.daddy.json. */
export const STATE_SUFFIX = ".daddy.json";
