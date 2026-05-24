// Gate for the panel trigger: open only when the editor is empty (mirrors subagent's gate).
// Authoritative check: ask pi (the editor's owner) for the live buffer rather than mirroring
// state. When the editor is empty, the trigger key carries no editing meaning.
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export function editorIsEmpty(ctx: ExtensionContext): boolean {
	return ctx.ui.getEditorText().trim().length === 0;
}
