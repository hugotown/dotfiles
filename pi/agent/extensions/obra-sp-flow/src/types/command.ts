import type { CommandCtx } from "./ports.ts";

export type ParsedCommand =
	| { kind: "help" }
	| { kind: "init" }
	| { kind: "continue"; selector?: string }
	| { kind: "start"; requirement: string };

export type CommandResult =
	| { kind: "help" }
	| { kind: "init"; path: string; created: boolean }
	| { kind: "continue"; runId: string | null }
	| { kind: "start"; runId: string; statePath: string; configSources: number }
	| { kind: "blocked"; reason: string };

export interface PiCommandApi {
	registerCommand(
		name: string,
		options: {
			description: string;
			handler: (args: string, ctx: CommandCtx) => Promise<CommandResult>;
		},
	): void;
	/** Inject a custom message into the session (subset of pi's ExtensionAPI). */
	sendMessage?(
		message: { customType: string; content: string; display?: boolean; details?: unknown },
		options?: { triggerTurn?: boolean; deliverAs?: "steer" | "followUp" | "nextTurn" },
	): void;
	/** Send a user message; always triggers a turn (subset of pi's ExtensionAPI). */
	sendUserMessage?(content: string, options?: { deliverAs?: "steer" | "followUp" }): void;
}
