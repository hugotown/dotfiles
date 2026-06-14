// nodes/interview.ts — Run one interactive AI interview step, then pause for the human answer.
import { QUESTION_PROHIBITION } from "../constants.ts";
import { detectSignal, stripSignalTags } from "../lib/completion.ts";
import { runPi } from "../lib/runner.ts";
import { substitute } from "../lib/variable-sub.ts";
import type { NodeResult, RunCtx, SubContext } from "../runtime-types.ts";
import type { InterviewSpec } from "../types.ts";

interface InterviewState {
  iteration?: number;
  answers?: string[];
  last_output?: string;
  pending_answer?: string;
}

function interviewState(value: unknown): InterviewState {
  return value && typeof value === "object" ? value as InterviewState : {};
}

export async function runInterview(rctx: RunCtx, run = runPi): Promise<NodeResult> {
  const { node, deps, sub, cwd } = rctx;
  const spec = node.interview as InterviewSpec;
  const provider = node.provider ?? deps.defaultProvider;
  const model = node.model ?? deps.defaultModel;
  if (!provider || !model) return { status: "failed", output: "", error: "No provider/model resolved" };

  const current = interviewState(rctx.state.nodes[node.id]?.structured);
  const iteration = current.iteration ?? 0;
  if (iteration >= spec.max_iterations) {
    return { status: "failed", output: current.last_output ?? "", error: `Interview exceeded ${spec.max_iterations} iterations` };
  }

  const answers = [...(current.answers ?? [])];
  const latestAnswer = current.pending_answer;
  if (latestAnswer !== undefined) answers.push(latestAnswer);

  const iterSub: SubContext = {
    ...sub,
    builtins: {
      ...sub.builtins,
      LOOP_PREV_OUTPUT: current.last_output ?? "",
      LOOP_USER_INPUT: latestAnswer ?? "",
      LOOP_ANSWERS: JSON.stringify(answers),
      LOOP_ANSWER_COUNT: String(answers.length),
    },
  };
  deps.onStream?.(node.id, `Interview step ${iteration + 1} - answers collected: ${answers.length}`);
  const r = await run({
    provider,
    model,
    thinking: node.thinking ?? "medium",
    tools: node.allowed_tools,
    system: QUESTION_PROHIBITION,
    task: substitute(spec.prompt, iterSub),
    cwd,
    signal: deps.signal,
    onUpdate: (p) => deps.progress?.(node.id, p),
    onThinking: (p) => deps.onThinking?.(node.id, p),
  });
  if (r.status === "failed") return { status: "failed", output: r.output, error: r.errorMessage ?? r.stderr };

  const output = stripSignalTags(r.output);
  const structured: Record<string, unknown> = { iteration: iteration + 1, answers, last_output: output };
  if (r.thinking) structured.thinking = r.thinking;
  if (detectSignal(r.output, spec.until)) return { status: "completed", output, structured };
  return { status: "paused", output, structured };
}
