// Pure rendering helpers shared by run/design render: status marker + two-column join.
import type { Status } from "../types.ts";

const MARKER: Record<Status, string> = { running: "*", ok: "+", failed: "x", skipped: "-", pending: "." };

export function statusMarker(status: Status): string {
	return MARKER[status];
}

export function joinColumns(left: string[], right: string[], height: number, leftWidth: number, gap: string): string[] {
	const rows: string[] = [];
	for (let i = 0; i < height; i++) {
		const l = (left[i] ?? "").padEnd(leftWidth);
		rows.push(`${l}${gap}${right[i] ?? ""}`);
	}
	return rows;
}
