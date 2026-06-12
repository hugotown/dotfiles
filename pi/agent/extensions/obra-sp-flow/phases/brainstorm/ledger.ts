// Pure ledger logic for the brainstorm question loop. The ledger is the compressed
// memory of the dialogue: it is the only thing the context hook re-injects each
// round (see compress.ts), so the verbose ask_user_question tool calls never
// accumulate. Reads the tool's `input` (done + assumptions) and `details`
// (answers) — both structured, no text parsing, no UI.

import type { AskOutcome, BrainstormScratch, LedgerAssumption, LedgerEntry } from "./types.ts";

function normConfidence(c: unknown): LedgerAssumption["confidence"] {
  return c === "high" || c === "low" ? c : "medium";
}

export function parseAskOutcome(input: unknown, details: unknown): AskOutcome {
  const inp = (input ?? {}) as { done?: unknown; assumptions?: unknown };
  const det = (details ?? {}) as { answers?: unknown };
  const qa: LedgerEntry[] = Array.isArray(det.answers)
    ? det.answers
        .map((a) => ({
          q: String((a as { question?: unknown })?.question ?? "").trim(),
          a: String((a as { answer?: unknown })?.answer ?? "").trim(),
        }))
        .filter((e) => e.q)
    : [];
  const assumptions: LedgerAssumption[] = Array.isArray(inp.assumptions)
    ? inp.assumptions
        .map((x) => ({
          text: String((x as { text?: unknown })?.text ?? "").trim(),
          confidence: normConfidence((x as { confidence?: unknown })?.confidence),
        }))
        .filter((e) => e.text)
    : [];
  return { done: inp.done === true, qa, assumptions };
}

/** Fold one round's outcome into the scratch (immutable). Dedupes assumptions by text. */
export function applyOutcome(s: BrainstormScratch, o: AskOutcome): BrainstormScratch {
  const seen = new Set(s.assumptions.map((a) => a.text));
  const assumptions = [...s.assumptions, ...o.assumptions.filter((a) => !seen.has(a.text))];
  return { ...s, rounds: s.rounds + 1, ledger: [...s.ledger, ...o.qa], assumptions, questionsDone: o.done };
}

/** Render the compact memory injected into each subsequent question round. */
export function renderLedger(s: BrainstormScratch): string {
  const lines: string[] = [];
  if (s.assumptions.length) {
    lines.push("### Assumptions on record (do not re-ask these)");
    for (const a of s.assumptions) lines.push(`- (${a.confidence}) ${a.text}`);
    lines.push("");
  }
  if (s.ledger.length) {
    lines.push("### Decisions resolved so far");
    for (const e of s.ledger) lines.push(`- ${e.q} => ${e.a}`);
  }
  return lines.join("\n").trim();
}
