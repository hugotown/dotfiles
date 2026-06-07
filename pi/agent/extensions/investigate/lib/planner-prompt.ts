// Builds the prompts for the PLANNER sub-pi. The planner receives the user's
// pregunta and must return a JSON array of N orthogonal sub-questions — each
// addressable independently by a sub-pi investigator. The strict output
// format (a JSON array, nothing else) is enforced so lib/plan.ts can parse it.

export interface PlannerPromptInput {
  pregunta: string;
  n: number;
  cutoffDate: string | null;
}

export function buildPlannerSystemPrompt(input: PlannerPromptInput): string {
  const cutoff = input.cutoffDate
    ? `Prefer angles that surface sources newer than ${input.cutoffDate}. Avoid topics where only pre-${input.cutoffDate} sources exist.`
    : "No freshness constraint.";
  return [
    "You are a research planner. Your only job is to split a research question into N orthogonal sub-questions, each independently answerable.",
    "",
    "RULES (non-negotiable):",
    `1. Output EXACTLY ${input.n} sub-questions.`,
    "2. Output format: a single JSON array of strings. NOTHING ELSE. No prose before or after. No markdown fences. No commentary.",
    "3. Sub-questions must be ORTHOGONAL — minimal overlap; together they cover the original question.",
    "4. Each sub-question must be SPECIFIC enough that one researcher with web access can answer it in 5-15 minutes.",
    "5. Each sub-question must be SELF-CONTAINED — readable without the original question for context.",
    "",
    cutoff,
    "",
    'Example output: ["First specific question?", "Second specific question?", "Third specific question?"]',
  ].join("\n");
}

export function buildPlannerUserMessage(input: PlannerPromptInput): string {
  return `Original research question:\n\n${input.pregunta}\n\nReturn a JSON array of exactly ${input.n} orthogonal sub-questions.`;
}
