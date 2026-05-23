// lib/prompts-design.ts — Prompts for design generation, revision, review, and auto-fix

export function getDesignPrompt(
  compressedContext: string,
  originalPrompt: string,
  selectedApproach: string,
  assumptions: string,
  answers: string,
): string {
  return `You are a senior software architect producing a complete design.

PROJECT CONTEXT:
${compressedContext}

USER REQUEST:
${originalPrompt}

VALIDATED ASSUMPTIONS:
${assumptions}

USER DECISIONS:
${answers}

SELECTED APPROACH:
${selectedApproach}

Generate a design structured in sections. Scale each section to its complexity —
a simple section can be 2-3 sentences, a complex one can be 200-300 words.
Include wireframes for visual sections.

Required sections (include ALL that apply, skip those that don't):
- architecture: High-level structure, boundaries, dependencies
- components: Key modules/files to create or modify
- data_flow: How data moves through the system
- api: Endpoints, contracts, request/response shapes
- ui: Screens, layouts, interactions (include wireframe)
- error_handling: Failure modes and recovery strategies
- testing: What to test and how

Each section should be self-contained enough to review independently.
Use the selected approach as your foundation. Do not revisit alternatives.

Call brainstorm_design with your complete design.`;
}

export function getRevisionPrompt(sectionContent: string, userFeedback: string): string {
  return `You are a senior software architect revising a section of a design spec.

CURRENT SECTION:
${sectionContent}

USER FEEDBACK:
${userFeedback}

Revise the section to address the feedback. Keep everything that wasn't criticized.
Call brainstorm_design_revision with the updated section.`;
}

export function getReviewPrompt(specContent: string): string {
  return `You are a senior architect performing a critical review of a design spec.
Your job is to find REAL problems, not nitpick style.

SPEC TO REVIEW:
${specContent}

Look for:
1. CONTRADICTIONS: Section A says X, section B says not-X
2. AMBIGUITY: A requirement that could be interpreted 2+ ways
3. PLACEHOLDERS: TBD, TODO, "will be defined later", vague hand-waving
4. GAPS: Important failure modes not covered, missing integration points
5. SCOPE CREEP: Things that weren't in the original requirements sneaking in

Do NOT flag:
- Style preferences
- Alternative approaches (that's already decided)
- Minor wording issues

If the spec is solid, return status: "pass". Don't invent issues.
Call brainstorm_review with your findings.`;
}

export function getAutoFixPrompt(specContent: string, issues: string): string {
  return `You are a senior architect fixing identified issues in a design spec.

SPEC:
${specContent}

ISSUES TO FIX:
${issues}

Apply the suggested fixes. For each issue, make the minimal change needed.
Call brainstorm_design with the complete updated design (all sections, not just fixed ones).`;
}
