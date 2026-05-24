// Authoritative check: is the user actively editing? Ask pi (the editor's owner)
// rather than mirroring state. When the editor is empty, the trigger key carries no
// editing meaning, so it is free to repurpose for the panel gesture.
//
// Note: we deliberately do NOT gate on "no conversation" — running subagents only exist
// because the user already started a conversation to launch them, so that would never pass.
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export function editorIsEmpty(ctx: ExtensionContext): boolean {
	return ctx.ui.getEditorText().trim().length === 0;
}
