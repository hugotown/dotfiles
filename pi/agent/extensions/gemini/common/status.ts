/** Consolidated gemini-common as an executable: verify key + connectivity + conventions. */
import { getClient, resolveApiKey } from "../lib/client";
import { IMAGE_MODELS, RESEARCH_AGENTS, TEXT_MODELS } from "../lib/models";

export interface StatusReport {
  text: string;
  ok: boolean;
}

export async function buildStatus(): Promise<StatusReport> {
  let keyLine: string;
  let ok = false;
  try {
    const key = resolveApiKey();
    const source = process.env.GEMINI_API_KEY ? "GEMINI_API_KEY" : "GOOGLE_API_KEY";
    keyLine = `✓ API key present via ${source} (${key.length} chars)`;
    ok = true;
  } catch (err) {
    keyLine = `✗ ${err instanceof Error ? err.message : String(err)}`;
  }

  let reach = "skipped (no key)";
  if (ok) {
    try { await getClient().models.list(); reach = "✓ reachable"; }
    catch (err) { reach = `✗ ${err instanceof Error ? err.message : String(err)}`; ok = false; }
  }

  const text = [
    "# Gemini setup", "", keyLine, `API connectivity: ${reach}`, "",
    "## Models",
    `- Image: ${IMAGE_MODELS.join(", ")}`,
    `- Text / Vision / Docs: ${TEXT_MODELS.join(", ")}`,
    `- Research agents: ${RESEARCH_AGENTS.join(", ")}`,
    "", "## Output",
    "Artifacts are saved under gemini-output/{images,vision,documents,grounded,research}/.",
  ].join("\n");
  return { text, ok };
}
