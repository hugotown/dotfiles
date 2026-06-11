// REDUCE phase orchestration. Three execution paths depending on how many
// findings we have:
//
//   1. Small run (N ≤ PARTITION_THRESHOLD): single synthesis pass (legacy).
//   2. Large run (N > PARTITION_THRESHOLD): map-reduce.
//        a. Partition findings into G groups of ≤ PARTITION_SIZE.
//        b. MAP: G partial-synth calls in parallel → G intermediate briefs.
//        c. REDUCE: one fusion-synth call → final report.
//
// On ANY synthesis failure we DO NOT throw — we return a raw-findings fallback
// (a deterministic concatenation of the findings prefixed with a notice) so the
// parent always gets SOMETHING actionable instead of hanging or losing data.
//
// `synth_timeout_ms` from the depth profile is the per-call hard timeout;
// `wall_clock_budget_ms` from the parent's AbortController bounds the whole run.
import { type DepthProfile, type Finding, SynthesizerError } from "../types.ts";
import { spawnPi } from "./spawn-pi.ts";
import {
  buildFusionSynthesizerSystemPrompt,
  buildFusionUserMessage,
  buildHealthSummary,
  buildPartialSynthesizerSystemPrompt,
  buildPartialSynthesizerUserMessage,
  buildSynthesizerSystemPrompt,
  buildSynthesizerUserMessage,
} from "./synth-prompt.ts";

/** When N findings exceeds this threshold we switch to map-reduce. */
export const PARTITION_THRESHOLD = 6;
/** Group size for the MAP step of map-reduce. */
export const PARTITION_SIZE = 4;

export interface SynthesizeInput {
  pregunta: string;
  findings: Finding[];
  cutoffDate: string | null;
  profile: DepthProfile;
  cwd: string;
  signal?: AbortSignal;
}

/** Split N findings into groups of at most `size`, distributing evenly. Pure, exported for testing. */
export function partitionFindings(findings: Finding[], size: number): Finding[][] {
  if (size <= 0) throw new Error(`partitionFindings: size must be positive (got ${size}).`);
  if (findings.length === 0) return [];
  // Balance group sizes: ceil(N/size) groups, each as even as possible.
  const groupCount = Math.ceil(findings.length / size);
  const groups: Finding[][] = Array.from({ length: groupCount }, () => []);
  // Distribute round-robin so adjacent findings (often related sub-questions
  // from sequential plan output) don't all land in the same group.
  for (let i = 0; i < findings.length; i++) {
    groups[i % groupCount].push(findings[i]);
  }
  return groups;
}

/** Deterministic fallback when the synthesizer fails entirely. Returns a Markdown blob the caller can surface. Pure, exported for testing. */
export function buildRawFindingsFallback(args: {
  pregunta: string;
  findings: Finding[];
  reason: string;
}): string {
  const health = buildHealthSummary(args.findings);
  const lines: string[] = [
    "# Reporte de investigación (fallback sin síntesis)",
    "",
    `**La síntesis falló y se devolvieron los hallazgos sin procesar.** Razón: ${args.reason}`,
    "",
    `**Pregunta original:** ${args.pregunta}`,
    "",
    `**${health}**`,
    "",
    "---",
    "",
    "## Hallazgos sin sintetizar",
    "",
  ];
  for (const [i, f] of args.findings.entries()) {
    const tags: string[] = [f.status];
    if (f.partial) tags.push("partial");
    if (typeof f.attempts === "number" && f.attempts > 0) tags.push(`${f.attempts + 1} intentos`);
    lines.push(`### ${i + 1}. ${f.subQuestion}`);
    lines.push(`*(${tags.join(", ")}, ${f.durationMs}ms)*`);
    lines.push("");
    if (f.text) lines.push(f.text);
    else if (f.errorMessage) lines.push(`_Sin texto recuperable. Error: ${f.errorMessage}_`);
    else lines.push("_Sin texto recuperable._");
    lines.push("");
    lines.push("---");
    lines.push("");
  }
  return lines.join("\n");
}

/** Run a single spawnPi call for synthesis. Throws SynthesizerError on any failure. */
async function runSynthesisStep(args: {
  systemPrompt: string;
  userMessage: string;
  profile: DepthProfile;
  cwd: string;
  signal?: AbortSignal;
  label: string;
}): Promise<string> {
  const result = await spawnPi({
    role: args.profile.synthesizer,
    thinking: args.profile.thinking,
    tools: [],
    systemPrompt: args.systemPrompt,
    userMessage: args.userMessage,
    cwd: args.cwd,
    timeoutMs: args.profile.synth_timeout_ms,
    signal: args.signal,
  });
  if (result.timedOut) throw new SynthesizerError(`${args.label}: timed out after ${args.profile.synth_timeout_ms}ms`);
  if (result.exitCode !== 0) throw new SynthesizerError(`${args.label}: exit ${result.exitCode}: ${result.stderr.slice(0, 300)}`);
  const text = result.finalText.trim();
  if (text.length === 0) throw new SynthesizerError(`${args.label}: empty text`);
  return text;
}

/** Single-pass synthesis (legacy path for small runs). */
async function singleSynthesis(input: SynthesizeInput): Promise<string> {
  return runSynthesisStep({
    systemPrompt: buildSynthesizerSystemPrompt(),
    userMessage: buildSynthesizerUserMessage({
      pregunta: input.pregunta,
      findings: input.findings,
      cutoffDate: input.cutoffDate,
    }),
    profile: input.profile,
    cwd: input.cwd,
    signal: input.signal,
    label: "synth",
  });
}

/** Map-reduce synthesis for large runs. */
async function mapReduceSynthesis(input: SynthesizeInput): Promise<string> {
  const groups = partitionFindings(input.findings, PARTITION_SIZE);
  const partialSystem = buildPartialSynthesizerSystemPrompt();

  // MAP: run all partial syntheses in parallel. If any individual partial
  // fails we DO NOT abort — we substitute a stub brief so the fusion step
  // still has something to work with. This is the same philosophy as the MAP
  // phase: degrade gracefully, surface health in the final report.
  const briefs = await Promise.all(
    groups.map(async (group, i): Promise<string> => {
      try {
        return await runSynthesisStep({
          systemPrompt: partialSystem,
          userMessage: buildPartialSynthesizerUserMessage({
            pregunta: input.pregunta,
            groupIndex: i,
            groupTotal: groups.length,
            findings: group,
            cutoffDate: input.cutoffDate,
          }),
          profile: input.profile,
          cwd: input.cwd,
          signal: input.signal,
          label: `partial-synth group ${i + 1}/${groups.length}`,
        });
      } catch (err) {
        const msg = (err as Error).message;
        console.error(`[investigate] partial synth ${i + 1}/${groups.length} failed: ${msg}`);
        // Substitute a stub brief that preserves the raw findings of this group.
        const rawList = group.map((f) => `- (${f.status}${f.partial ? "/partial" : ""}) **${f.subQuestion}**: ${f.text.slice(0, 800)}${f.text.length > 800 ? "…" : ""}`).join("\n");
        return [
          `## Brief parcial`,
          `_Síntesis parcial falló: ${msg}. Datos crudos de este grupo:_`,
          "",
          `## Datos extraídos`,
          rawList,
          "",
          `## Contradicciones internas`,
          `No analizadas (síntesis parcial falló).`,
          "",
          `## Fuentes citadas`,
          `Ver datos crudos arriba.`,
        ].join("\n");
      }
    }),
  );

  // REDUCE: fusion step. If this fails, the caller's catch will produce the raw fallback.
  return runSynthesisStep({
    systemPrompt: buildFusionSynthesizerSystemPrompt(),
    userMessage: buildFusionUserMessage({
      pregunta: input.pregunta,
      briefs,
      findings: input.findings,
      cutoffDate: input.cutoffDate,
    }),
    profile: input.profile,
    cwd: input.cwd,
    signal: input.signal,
    label: "fusion-synth",
  });
}

/** Whether to use map-reduce path. Exported for testing. */
export function shouldUseMapReduce(findingCount: number): boolean {
  return findingCount > PARTITION_THRESHOLD;
}

export async function synthesize(input: SynthesizeInput): Promise<string> {
  const useMapReduce = shouldUseMapReduce(input.findings.length);
  console.error(`[investigate] synth strategy: ${useMapReduce ? `map-reduce (${Math.ceil(input.findings.length / PARTITION_SIZE)} groups of ≤${PARTITION_SIZE})` : "single"}`);

  // ONE retry on the WHOLE synthesis pipeline. If both fail, fall back to raw findings.
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (input.signal?.aborted) break;
    try {
      return useMapReduce ? await mapReduceSynthesis(input) : await singleSynthesis(input);
    } catch (err) {
      lastError = err as Error;
      console.error(`[investigate] synth attempt ${attempt + 1}/2 failed: ${lastError.message}`);
    }
  }

  // Both attempts failed (or signal aborted). Return raw-findings fallback so the
  // caller ALWAYS gets a usable artefact instead of an exception that loses data.
  const reason = input.signal?.aborted
    ? "investigate run was aborted (wall-clock budget exceeded or upstream cancellation)"
    : (lastError?.message ?? "unknown synthesis failure");
  console.error(`[investigate] synth fallback engaged: ${reason}`);
  return buildRawFindingsFallback({
    pregunta: input.pregunta,
    findings: input.findings,
    reason,
  });
}
