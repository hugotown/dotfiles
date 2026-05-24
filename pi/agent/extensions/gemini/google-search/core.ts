/** gemini-google-search core: real-time grounded answer + citations. */
import { getClient } from "../lib/client";
import { outputPath, saveText } from "../lib/output";
import { addCitations, getMetadata, listSources } from "./citations";

export interface SearchResult {
  cited: string; // answer with inline [n](uri) citations
  sources: string; // markdown sources list
  path: string;
}

export async function groundedSearch(query: string, model: string, cwd: string): Promise<SearchResult> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model,
    contents: query,
    config: { tools: [{ googleSearch: {} }] },
  });

  const text = response.text ?? "";
  if (!text.trim()) throw new Error("Empty response from Gemini Google Search.");
  const md = getMetadata(response);
  const cited = addCitations(text, md);
  const sources = listSources(md);
  const path = saveText(outputPath(cwd, "grounded", query, "md"), `${cited}\n\n${sources}`);
  return { cited, sources, path };
}
