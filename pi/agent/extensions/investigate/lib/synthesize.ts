// Orchestrates the SYNTHESIZER sub-pi: feeds it the original pregunta and all
// N findings, returns the final report text. If synthesis fails, we throw
// SynthesizerError so the parent surfaces a tool error containing the raw
// findings (the principal can still recover something).
import { type DepthProfile, type Finding, SynthesizerError } from "../types.ts";
import { spawnPi } from "./spawn-pi.ts";
import { buildSynthesizerSystemPrompt, buildSynthesizerUserMessage } from "./synth-prompt.ts";

export interface SynthesizeInput {
  pregunta: string;
  findings: Finding[];
  cutoffDate: string | null;
  profile: DepthProfile;
  cwd: string;
  signal?: AbortSignal;
}

export async function synthesize(input: SynthesizeInput): Promise<string> {
  const systemPrompt = buildSynthesizerSystemPrompt();
  const userMessage = buildSynthesizerUserMessage({ pregunta: input.pregunta, findings: input.findings, cutoffDate: input.cutoffDate });
  let lastError: SynthesizerError | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const isLastAttempt = attempt === 1;
    try {
      const result = await spawnPi({
        role: input.profile.synthesizer,
        thinking: input.profile.thinking,
        tools: [],
        systemPrompt,
        userMessage,
        cwd: input.cwd,
        timeoutMs: input.profile.subpi_timeout_ms,
        signal: input.signal,
      });
      if (result.timedOut) throw new SynthesizerError(`synthesizer sub-pi timed out (exit ${result.exitCode})`);
      if (result.exitCode !== 0) throw new SynthesizerError(`synthesizer sub-pi exit ${result.exitCode}: ${result.stderr.slice(0, 300)}`);
      const text = result.finalText.trim();
      if (text.length === 0) throw new SynthesizerError("synthesizer sub-pi returned empty text");
      return text;
    } catch (err) {
      if (isLastAttempt || input.signal?.aborted) throw err;
      lastError = err instanceof SynthesizerError ? err : new SynthesizerError(String(err));
    }
  }
  throw lastError!;
}
