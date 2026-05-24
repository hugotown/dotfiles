/** gemini-deep-research core: start a background interaction and poll to completion. */
import { getClient } from "../lib/client";
import { outputPath, saveText } from "../lib/output";

const POLL_MS = 10_000;

export async function startResearch(input: string, agent: string): Promise<string> {
  const ai = getClient();
  const interaction = await ai.interactions.create({ input, agent, background: true });
  return interaction.id;
}

export interface ResearchDone {
  status: string;
  text: string;
  path?: string;
}

/** Poll every 10s until the interaction leaves `in_progress`; save the report on success. */
export async function pollResearch(id: string, query: string, cwd: string): Promise<ResearchDone> {
  const ai = getClient();
  for (;;) {
    const cur = await ai.interactions.get(id);
    if (cur.status !== "in_progress") {
      const text = cur.output_text ?? "";
      if (cur.status === "completed" && text.trim()) {
        return { status: cur.status, text, path: saveText(outputPath(cwd, "research", query, "md"), text) };
      }
      return { status: cur.status, text };
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}
