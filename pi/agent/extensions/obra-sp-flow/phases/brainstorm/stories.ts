// Pure validation for user stories produced by the stories node.
// Checks structural completeness: at least one story with Given/When/Then format.

export interface StoriesValidation {
  valid: boolean;
  problems: string[];
}

/** Validate that the stories text contains properly structured Given/When/Then
 *  acceptance criteria. Intentionally lenient on wording (accepts Given/Dado,
 *  When/Cuando, Then/Entonces) to support bilingual specs. */
export function validateStories(stories: string): StoriesValidation {
  const text = stories.trim();
  const problems: string[] = [];

  if (text.length < 50) {
    problems.push("too short — write at least one complete user story with Given/When/Then");
  }

  // Count Given/When/Then blocks (case-insensitive, supports Spanish variants)
  const givenPattern = /\b(given|dado|dada)\b/gi;
  const whenPattern = /\b(when|cuando)\b/gi;
  const thenPattern = /\b(then|entonces)\b/gi;

  const givenCount = (text.match(givenPattern) ?? []).length;
  const whenCount = (text.match(whenPattern) ?? []).length;
  const thenCount = (text.match(thenPattern) ?? []).length;

  if (givenCount === 0 || whenCount === 0 || thenCount === 0) {
    problems.push("missing Given/When/Then structure — each story needs all three clauses");
  }

  // Must have at least one "As a..." or "Como..." (user story format)
  if (!/\b(as a|como un[oa]?)\b/i.test(text)) {
    problems.push("missing user role — start each story with 'As a <role>' or 'Como un <rol>'");
  }

  return { valid: problems.length === 0, problems };
}
