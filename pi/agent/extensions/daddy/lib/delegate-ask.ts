// AI-ask delegation (design §10). Capture the user's model + active tools, inject a hidden
// marker (so the context filter trims to it), then sendUserMessage to trigger a main-agent
// turn. The run SUSPENDS after this; agent_end (index.ts) captures the answer and resumes.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { ASK_MARKER } from "../constants.ts";
import { resolveRefs } from "./resolve-refs.ts";
import type { NodeState, StateMachine } from "../types.ts";

export interface SavedDefaults {
	model: { provider: string; id: string } | null;
	tools: string[];
}

/** Snapshot the user's current model + active tools so they can be restored on agent_end. */
export function captureDefaults(pi: ExtensionAPI, model: { provider: string; id: string } | undefined): SavedDefaults {
	return { model: model ?? null, tools: pi.getAllTools().map((t) => t.name) };
}

const ASK_INSTRUCTION =
	"Loop ask_user_question: each round state your assumptions and ask adaptive clarifying questions, " +
	"and ALWAYS include a final option 'proceed'. Stop as soon as you have no more doubts OR the user " +
	"selects 'proceed'. Then state the agreed decisions in plain text as your final message.";

/** Trigger the delegated turn. Caller must already have set the model/tools (index.ts). */
export function delegateAsk(pi: ExtensionAPI, node: NodeState, state: StateMachine): void {
	const why = resolveRefs(node.prompt ?? "", state, state.arguments);
	pi.sendMessage({ customType: ASK_MARKER, content: "", display: false }, { triggerTurn: false });
	pi.sendUserMessage(`${why}\n\n${ASK_INSTRUCTION}`);
}
