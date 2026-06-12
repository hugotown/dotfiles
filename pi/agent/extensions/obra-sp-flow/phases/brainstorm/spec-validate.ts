// Pure, deterministic quality gate for the spec the model commits via obra_spec.
// This replaces the skill's "trust the model to self-review" step with a real
// check: if the spec is incomplete, obra_spec rejects it and the model fixes it.
// Kept intentionally lenient (substance, not section-name nitpicking) so good
// specs aren't rejected over heading wording.

export function validateSpec(spec: string): string[] {
  const text = spec.trim();
  const problems: string[] = [];
  if (text.length < 400) problems.push("too short to be a complete design (resolve all sections before committing)");
  // No regex placeholder gate — a mention ("no TBD/TODO") or the project's todoRouter
  // is indistinguishable from a real placeholder by regex and caused false negatives.
  if (!/decisions?\s*&?\s*resolved|resolved\s+ambiguit/i.test(text)) {
    problems.push("missing the '## Decisions & Resolved Ambiguities' section (reproduce the decision ledger)");
  }
  if (!/\btests?\b|\bcoverage\b/i.test(text)) {
    problems.push("missing a test strategy (unit/integration/e2e + coverage target)");
  }
  // Acceptance criteria: the spec must include Given/When/Then scenarios from the
  // stories node. Supports English and Spanish variants.
  if (!/\b(given|dado|dada)\b/i.test(text) || !/\b(when|cuando)\b/i.test(text) || !/\b(then|entonces)\b/i.test(text)) {
    problems.push("missing acceptance criteria with Given/When/Then scenarios (include the user stories)");
  }
  return problems;
}
