// Context compression for the brainstorm question loop — the mechanism that makes
// the token win real. A normal conversational brainstorm grows the transcript by
// ~1.5-2.5k tokens per question (thinking + verbose ask_user_question tool calls).
// This collapses everything after the phase marker into a single synthetic user
// message carrying only the compact ledger, so each round sees [core+repo map] +
// [decisions so far] and nothing else.
//
// Safe because it runs at the `context` hook (before an LLM call): every prior
// ask_user_question round is already closed, so dropping the whole post-marker
// block leaves no toolCall unpaired. With no ledger yet it just keeps the marker
// (same behavior as the old filterContext slice).

import { PHASE_MARKER } from "../../orchestrator.ts";

interface MaybeMarker {
  customType?: string;
}

export function compressBrainstorm<T>(messages: T[], ledgerText: string): T[] {
  let marker = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if ((messages[i] as MaybeMarker).customType === PHASE_MARKER) {
      marker = i;
      break;
    }
  }
  if (marker === -1) return messages;
  const head = messages[marker];
  if (!ledgerText.trim()) return [head];
  const synthetic = { role: "user", content: ledgerText, timestamp: Date.now() } as unknown as T;
  return [head, synthetic];
}
