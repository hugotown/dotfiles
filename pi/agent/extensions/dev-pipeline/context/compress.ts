import { estimateTokens } from "@earendil-works/pi-coding-agent";

/** FR-9: ≤ ~2,000 tokens; hard char cap ~8K as a backstop. */
export const MAX_CONTEXT_TOKENS = 2000;
export const MAX_CONTEXT_CHARS = 8000;

export interface ContextParts {
	stack: string;
	probes: string;
	tree: string;
}

/**
 * Compose the deterministic context into a single block, bounded to the budget.
 * Stack + probes are the cheapest, highest-signal sections and are kept whole;
 * the file tree is the large, lower-priority section and is truncated first.
 */
export function compressContext(parts: ContextParts): string {
	const header = [`## Stack\n${parts.stack}`, `## Tooling\n${parts.probes}`].join("\n\n");
	const treeHeader = "## Project tree\n";

	// Budget for the tree = whatever remains under the char cap after the header.
	const reserved = header.length + treeHeader.length + 4;
	let tree = parts.tree;
	const treeBudget = MAX_CONTEXT_CHARS - reserved;
	if (tree.length > treeBudget) {
		tree = `${tree.slice(0, Math.max(0, treeBudget - "\n[truncated]".length))}\n[truncated]`;
	}

	let out = `${header}\n\n${treeHeader}${tree}`;

	// Token backstop: if still over the token budget, trim the tree further.
	// estimateTokens takes an AgentMessage; wrap the string in a minimal user message
	// (the type is not re-exported from the package root, so derive it from the fn signature).
	const asMessage = (text: string) =>
		({ role: "user", content: text }) as Parameters<typeof estimateTokens>[0];
	while (estimateTokens(asMessage(out)) > MAX_CONTEXT_TOKENS && tree.length > 0) {
		tree = `${tree.slice(0, Math.floor(tree.length * 0.8))}\n[truncated]`;
		out = `${header}\n\n${treeHeader}${tree}`;
	}

	return out;
}
