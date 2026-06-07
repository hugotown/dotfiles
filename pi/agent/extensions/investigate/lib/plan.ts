// Orchestrates the PLANNER: spawn a sub-pi with no tools, ask for a JSON array
// of N sub-questions, parse and validate it. parsePlannerOutput is pure and
// exported for unit testing.
import { PlannerOutputError, type DepthProfile } from "../types.ts";
import { buildPlannerSystemPrompt, buildPlannerUserMessage } from "./planner-prompt.ts";
import { spawnPi } from "./spawn-pi.ts";

const ARRAY_RE = /\[[\s\S]*?\]/;

export function parsePlannerOutput(rawText: string, expectedCount: number): string[] {
  // Strip optional ```json``` fence first.
  const text = rawText.replace(/```(?:json)?\s*/i, "").replace(/```$/i, "");
  const match = text.match(ARRAY_RE);
  if (!match) throw new PlannerOutputError("no JSON array found in output", rawText);
  let parsed: unknown;
  try { parsed = JSON.parse(match[0]); } catch { throw new PlannerOutputError("could not JSON.parse the array", rawText); }
  if (!Array.isArray(parsed)) throw new PlannerOutputError("parsed value is not an array", rawText);
  if (parsed.length !== expectedCount) throw new PlannerOutputError(`expected ${expectedCount} sub-questions, got ${parsed.length}`, rawText);
  for (const [i, item] of parsed.entries()) {
    if (typeof item !== "string") throw new PlannerOutputError(`sub-question ${i} is not a string`, rawText);
    if (item.trim().length === 0) throw new PlannerOutputError(`sub-question ${i} is empty`, rawText);
  }
  return parsed as string[];
}

export interface PlanInvocation {
  pregunta: string;
  n: number;
  cutoffDate: string | null;
  profile: DepthProfile;
  cwd: string;
  signal?: AbortSignal;
}

export async function planSubQuestions(input: PlanInvocation): Promise<string[]> {
  const systemPrompt = buildPlannerSystemPrompt({ pregunta: input.pregunta, n: input.n, cutoffDate: input.cutoffDate });
  const userMessage = buildPlannerUserMessage({ pregunta: input.pregunta, n: input.n, cutoffDate: input.cutoffDate });
  const result = await spawnPi({
    role: input.profile.planner,
    thinking: input.profile.thinking,
    tools: [], // planner has no tool calling
    systemPrompt,
    userMessage,
    cwd: input.cwd,
    timeoutMs: input.profile.subpi_timeout_ms,
    signal: input.signal,
  });
  if (result.timedOut) throw new PlannerOutputError("planner sub-pi timed out", result.stderr);
  if (result.exitCode !== 0) throw new PlannerOutputError(`planner sub-pi exit ${result.exitCode}`, result.stderr);
  return parsePlannerOutput(result.finalText, input.n);
}
