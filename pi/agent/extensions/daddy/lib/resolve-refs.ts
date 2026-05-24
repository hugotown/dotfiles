// Substitute $node.output and $ARGUMENTS into a node's prompt/context. This is the
// context-economy mechanism: a node sees only the upstream outputs it names (design §7).
import { findNode } from "./flat-nodes.ts";
import type { StateMachine } from "../types.ts";

const REF = /\$([A-Za-z][\w-]*)\.output/g;

/** All distinct node ids referenced via $id.output (excludes $ARGUMENTS). */
export function collectRefs(text: string): string[] {
	const ids: string[] = [];
	for (const m of text.matchAll(REF)) if (!ids.includes(m[1])) ids.push(m[1]);
	return ids;
}

/** Replace $ARGUMENTS and every $id.output with persisted text. Throws on unknown ids. */
export function resolveRefs(text: string, state: StateMachine, args: string): string {
	const withArgs = text.split("$ARGUMENTS").join(args);
	return withArgs.replace(REF, (_full, id: string) => {
		const node = findNode(state, id);
		if (!node) throw new Error(`unknown reference: $${id}.output`);
		return node.output ?? "";
	});
}
