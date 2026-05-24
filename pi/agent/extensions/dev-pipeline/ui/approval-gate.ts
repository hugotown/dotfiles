import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export const MAX_GATE_ATTEMPTS = 3;

export type GateResult =
	| { kind: "approved" }
	| { kind: "rejected"; feedback: string }
	| { kind: "cancelled" };

/**
 * Human approval gate (FR-16/21). Presents approve / reject / cancel.
 * On reject, collects feedback via the editor to drive the next revision.
 */
export async function approvalGate(ctx: ExtensionContext, what: string, artifactPath: string): Promise<GateResult> {
	ctx.ui.notify(`${what} written to ${artifactPath}. Review it, then choose below.`, "info");
	const choice = await ctx.ui.select(`Approve the ${what}?`, [
		"Approve",
		"Reject (give feedback to revise)",
		"Cancel pipeline",
	]);

	if (choice === "Approve") return { kind: "approved" };
	if (choice === "Reject (give feedback to revise)") {
		const feedback = (await ctx.ui.editor(`What should change in the ${what}?`, "")) ?? "";
		return { kind: "rejected", feedback: feedback.trim() };
	}
	return { kind: "cancelled" };
}
