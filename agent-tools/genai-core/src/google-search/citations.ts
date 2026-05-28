/** Grounding-metadata helpers for Google Search results. */
interface GroundingMetadata {
  groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
  groundingSupports?: Array<{ segment?: { endIndex?: number }; groundingChunkIndices?: number[] }>;
  webSearchQueries?: string[];
}

export function getMetadata(response: unknown): GroundingMetadata | undefined {
  return (response as { candidates?: Array<{ groundingMetadata?: GroundingMetadata }> })
    .candidates?.[0]?.groundingMetadata;
}

/** Splice [n](uri) citations after each grounded span. Right-to-left keeps offsets valid. */
export function addCitations(text: string, md: GroundingMetadata | undefined): string {
  const supports = md?.groundingSupports;
  const chunks = md?.groundingChunks ?? [];
  if (!supports?.length) return text;

  let out = text;
  const ordered = [...supports].sort((a, b) => (b.segment?.endIndex ?? 0) - (a.segment?.endIndex ?? 0));
  for (const s of ordered) {
    const end = s.segment?.endIndex;
    const idx = s.groundingChunkIndices;
    if (end === undefined || !idx?.length) continue;
    const cites = idx.map((i) => (chunks[i]?.web?.uri ? `[${i + 1}](${chunks[i]!.web!.uri})` : "")).filter(Boolean);
    if (cites.length) out = out.slice(0, end) + " " + cites.join(", ") + out.slice(end);
  }
  return out;
}

export function listSources(md: GroundingMetadata | undefined): string {
  const chunks = md?.groundingChunks ?? [];
  if (!chunks.length) return "_No web sources returned._";
  const lines = chunks.map((c, i) => `${i + 1}. [${c.web?.title ?? c.web?.uri ?? "source"}](${c.web?.uri ?? ""})`);
  return `## Sources\n\n${lines.join("\n")}`;
}
