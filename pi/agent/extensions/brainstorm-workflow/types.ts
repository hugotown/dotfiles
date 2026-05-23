// types.ts — Shared interfaces for the brainstorm workflow

export type Phase =
  | "IDLE"
  | "GATHERING_CONTEXT"
  | "RESEARCHING_AND_QUESTIONING"
  | "FORM_INTERACTION"
  | "PROPOSING_APPROACHES"
  | "APPROACH_SELECTION"
  | "GENERATING_DESIGN"
  | "DESIGN_REVIEW"
  | "WRITING_SPEC"
  | "SELF_REVIEW"
  | "USER_REVIEW"
  | "COMPLETE";

export interface Assumption {
  id: string;
  text: string;
  confidence: "high" | "medium" | "low";
}

export interface Question {
  id: string;
  label: string;
  type: "select" | "text";
  options?: string[];
  default: string;
  reasoning: string;
}

export interface Wireframe {
  description: string;
  lines: string[];
}

export interface Approach {
  id: string;
  title: string;
  summary: string;
  pros: string[];
  cons: string[];
  effort: "low" | "medium" | "high";
  risk: "low" | "medium" | "high";
  wireframe?: Wireframe;
}

export interface DesignSection {
  id: string;
  title: string;
  content: string;
  wireframe?: Wireframe;
}

export interface ReviewIssue {
  id: string;
  section: string;
  severity: "high" | "medium" | "low";
  type: "contradiction" | "ambiguity" | "placeholder" | "gap" | "scope_creep";
  description: string;
  suggestion: string;
}

export interface ReviewResult {
  status: "pass" | "issues_found";
  issues: ReviewIssue[];
  summary: string;
}
