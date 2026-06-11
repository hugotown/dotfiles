// TypeBox schema for `investigate` parameters. Descriptions guide the calling LLM
// to pick the right depth and craft specific preguntas.
import { Type } from "typebox";

const DepthSchema = Type.Union(
  [Type.Literal("light"), Type.Literal("medium"), Type.Literal("high"), Type.Literal("deep")],
  {
    description:
      "Investigation budget. Realistic wall-clock budgets: 'light' = 3 sub-questions (~1-2min, simple lookup); 'medium' = 5 (~3-5min, standard analysis); 'high' = 8 (~5-10min, broad research); 'deep' = 12 (~10-15min, thesis-grade). Pick the smallest depth that fits — deep is expensive AND slow. Do NOT reinvoke the tool while a call is still running.",
  },
);

const FreshnessSchema = Type.Union(
  [
    Type.Literal("any"),
    Type.Literal("day"),
    Type.Literal("week"),
    Type.Literal("month"),
    Type.Literal("year"),
  ],
  {
    description:
      "Time bias passed to the investigator as a system-prompt hint (sub-pi must filter results manually — no hard backend filter). Default from config (typically 'year').",
  },
);

export const InvestigateParams = Type.Object({
  pregunta: Type.String({
    minLength: 10,
    maxLength: 500,
    description:
      "Specific research question. BAD: 'React'. GOOD: 'state management patterns for React 19 server components'. The planner will split it into orthogonal sub-questions.",
  }),
  depth: DepthSchema,
  freshness: Type.Optional(FreshnessSchema),
});
