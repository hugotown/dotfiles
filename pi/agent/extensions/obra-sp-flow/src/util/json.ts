/** Extract a JSON object from a child's final text (tolerates fences/prose). */

function tryParse(text: string): unknown | null {
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}

/** Scan from the first `{` to its matching `}` honoring strings/escapes. */
function extractBalanced(text: string): unknown | null {
	const start = text.indexOf("{");
	if (start < 0) return null;
	let depth = 0;
	let inStr = false;
	let esc = false;
	for (let i = start; i < text.length; i++) {
		const c = text[i];
		if (inStr) {
			if (esc) esc = false;
			else if (c === "\\") esc = true;
			else if (c === '"') inStr = false;
			continue;
		}
		if (c === '"') inStr = true;
		else if (c === "{") depth++;
		else if (c === "}" && --depth === 0) return tryParse(text.slice(start, i + 1));
	}
	return null;
}

export function parseJsonLoose(text: string): any | null {
	if (!text) return null;
	let t = text.trim();
	const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
	if (fence) t = fence[1].trim();
	const direct = tryParse(t);
	return direct !== null ? direct : extractBalanced(t);
}
