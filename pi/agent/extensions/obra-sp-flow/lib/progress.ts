// Live progress feedback in the MAIN chat (not a generic "working..." spinner).
// Each node announces its milestones so the user always sees what is happening
// ("preguntando…", "redactando el spec…", "creando 10 archivos…"). Uses a custom
// message with display:true and triggerTurn:false: it renders in the transcript
// but the LLM does NOT act on it. These entries carry customType PROGRESS_ENTRY so
// the context hooks can drop them from the LLM context — visual, zero LLM tokens.

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

export const PROGRESS_ENTRY = "obra-sp-flow-progress";

export interface Progress {
  icon?: string;
  text: string;
}

/** Pure render of a progress line (testable without pi). */
export function progressLine(p: Progress): string {
  return p.icon ? `${p.icon} ${p.text}` : p.text;
}

/** Show a progress line in the main chat without triggering an LLM turn. */
export function announce(pi: ExtensionAPI, p: Progress): void {
  pi.sendMessage({ customType: PROGRESS_ENTRY, content: progressLine(p), display: true }, { triggerTurn: false });
}

/** Live "working…" indicator text, shown WHILE the agent is busy — e.g. during an
 *  isolated child run inside a handler, where chat announces don't render until the
 *  handler returns. Pass nothing to restore the default indicator. */
export function working(ctx: ExtensionContext, text?: string): void {
  ctx.ui.setWorkingMessage(text);
}
