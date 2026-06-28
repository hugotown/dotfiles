/** UI / feedback ports (phases depend on these abstractions, not the TUI). */

export type NotifyLevel = "info" | "warning" | "error";

export interface UiPort {
	notify(text: string, level?: NotifyLevel): void;
	setStatus(id: string, text: string | undefined): void;
	setWidget(id: string, lines: string[] | undefined): void;
	confirm(title: string, message: string, opts?: unknown): Promise<boolean>;
	select(title: string, options: string[]): Promise<string | undefined>;
	input(prompt: string, placeholder?: string): Promise<string | undefined>;
}

/** Live-progress port used by phases to emit ticks. */
export interface FeedbackPort {
	tick(line: string): void;
}

/** Structural subset of pi's ExtensionCommandContext we rely on. */
export interface CommandCtx {
	cwd: string;
	hasUI: boolean;
	mode: string;
	signal?: AbortSignal;
	sessionManager: {
		getSessionFile(): string | null | undefined;
		getSessionId?(): string | null | undefined;
	};
	ui: UiPort;
	waitForIdle?: () => Promise<void>;
}
