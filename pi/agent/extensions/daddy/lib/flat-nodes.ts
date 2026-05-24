// The driver, validator and resolver operate on the flat node list; the VSM>SIPOC
// containment is only for the map. These helpers flatten/index a StateMachine.
import type { NodeState, StateMachine } from "../types.ts";

export function allNodes(state: StateMachine): NodeState[] {
	return state.vsm.flatMap((chain) => chain.nodes);
}

export function findNode(state: StateMachine, id: string): NodeState | undefined {
	return allNodes(state).find((n) => n.id === id);
}
