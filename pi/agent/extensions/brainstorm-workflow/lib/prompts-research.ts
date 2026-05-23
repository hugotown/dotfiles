// lib/prompts-research.ts — Prompts for research + approaches phases

export function getResearchPrompt(
  compressedContext: string,
  originalPrompt: string,
  previousAnswers?: Record<string, string>,
): string {
  const answersSection = previousAnswers && Object.keys(previousAnswers).length > 0
    ? `\nPrevious answers from user:\n${Object.entries(previousAnswers)
        .map(([k, v]) => `- ${k}: ${v}`)
        .join("\n")}\n`
    : "";

  return `You are a senior software architect doing pre-design research.

PROJECT CONTEXT:
${compressedContext}

USER REQUEST:
${originalPrompt}
${answersSection}
PHASE 1 - RESEARCH:
Research best practices for the user's request using the available tools:
- Use bash to run ctx7 commands for library documentation detected in the project
- Use bash to run ddg for general best practices, market standards, proven patterns
- Use bash for ddg as fallback when ctx7 doesn't have sufficient info
- If the context mentions graphify-out exists, use bash to query the knowledge graph

PHASE 2 - QUESTIONS:
After researching, call brainstorm_questions with strategic questions.
Every question MUST have its default pre-filled with the best practice
you found during research. Rules:
- Do NOT ask what you can infer from project context — state it as an assumption
- Pre-fill defaults with RESEARCHED best practices, cite the source in reasoning
- Filter out options that contradict the detected stack
- If the answer is obvious from context + research, DON'T ASK — add it as
  an assumption with high confidence instead
- 2-5 questions per round. Fewer is better if high-value.
- Set "done": true when you have enough info to propose 2-3 design approaches

The user should only need to press Enter to accept your recommendations.
If they need to change something, it means your research missed something.`;
}

export function getApproachesPrompt(
  compressedContext: string,
  originalPrompt: string,
  assumptions: string,
  answers: string,
): string {
  return `You are a senior software architect proposing design approaches.

PROJECT CONTEXT:
${compressedContext}

USER REQUEST:
${originalPrompt}

VALIDATED ASSUMPTIONS:
${assumptions}

USER DECISIONS:
${answers}

Generate 2-3 approaches with clear tradeoffs. Call brainstorm_approaches with:
- Each approach: title, summary (2-3 sentences), pros, cons, effort, risk
- Your recommendation with detailed reasoning
- Optional wireframe (ONLY for visual decisions: UI layout, screen flow)

WIREFRAME RULES (when applicable):
- Use box-drawing characters (┌─┐│└┘) for structure
- Use {{color}} tags for semantic meaning: {{accent}}, {{success}}, {{warning}}, {{error}}, {{muted}}, {{dim}}, {{bold}}
- Keep under 20 lines — convey layout, not pixel-perfect design
- Only include when the approach involves a VISUAL decision`;
}
