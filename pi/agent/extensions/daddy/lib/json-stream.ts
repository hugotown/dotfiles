// Fold `pi --mode json` stdout lines. Consumers: the latest assistant text (flag fallback),
// a specific custom message by type (llm node's append_node result), and the last custom
// message of ANY type (generic flag node). Custom messages appear as message_start AND
// message_end events with role:"custom" + customType and a string content (verified against
// a real `--hello` stream: type=message_end role=custom customType=hello-world content="world").
interface PiEvent {
	type?: string;
	message?: { role?: string; customType?: string; content?: Array<{ type: string; text?: string }> | string };
}

function parseLines(lines: string[]): PiEvent[] {
	const out: PiEvent[] = [];
	for (const line of lines) {
		if (!line.trim()) continue;
		try {
			out.push(JSON.parse(line) as PiEvent);
		} catch {
			/* skip non-JSON */
		}
	}
	return out;
}

/** Latest assistant text across the stream. */
export function lastAssistantText(lines: string[]): string {
	let text = "";
	for (const ev of parseLines(lines)) {
		if (ev.type !== "message_end" || ev.message?.role !== "assistant") continue;
		const content = ev.message.content;
		if (typeof content === "string") text = content;
		else for (const part of content ?? []) if (part.type === "text" && part.text) text = part.text;
	}
	return text;
}

function customContent(message: NonNullable<PiEvent["message"]>): string {
	const c = message.content;
	return typeof c === "string" ? c : JSON.stringify(c);
}

/** The content of the last custom message with the given customType, or null. */
export function lastCustomMessage(lines: string[], customType: string): string | null {
	let found: string | null = null;
	for (const ev of parseLines(lines)) {
		if (ev.type === "message_end" && ev.message?.role === "custom" && ev.message.customType === customType) {
			found = customContent(ev.message);
		}
	}
	return found;
}

/** The content of the last custom message of ANY type, or null (generic flag capture). */
export function lastCustomMessageAny(lines: string[]): string | null {
	let found: string | null = null;
	for (const ev of parseLines(lines)) {
		if (ev.type === "message_end" && ev.message?.role === "custom") {
			found = customContent(ev.message);
		}
	}
	return found;
}
