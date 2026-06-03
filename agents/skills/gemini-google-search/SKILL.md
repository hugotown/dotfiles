---
name: gemini-google-search
description: Use when grounding a Gemini response in Google Search (real-time web data, current events, post-training facts). Triggers — "Gemini búsqueda en google", "search the web with Gemini", "ground this answer", "cite sources", "what happened today", "latest news on X", "who won the election", "current price of Y", "fact-check with citations", "search-augmented answer". Adds the google_search tool, returns groundingMetadata with web sources, and provides citation-attachment helper. Different from gemini-deep-research (one-shot vs multi-step agentic research) and from gemini-image-generation's grounding mode.
---

# Gemini Google Search — Grounding with Citations

Source: <https://ai.google.dev/gemini-api/docs/google-search>

**REQUIRED BACKGROUND:** `gemini-common`.

## Quick Reference

| File | Contents |
|------|----------|
| [citations.md](citations.md) | The exact citation-attaching helper (Python + JS) and the structure of `groundingMetadata`. |

## What this does

Adds the `google_search` tool to a `generateContent` call. The model runs one or more web searches, reads the results, and synthesizes the answer. The response includes a `groundingMetadata` block with:

- `webSearchQueries` — the queries the model actually ran
- `searchEntryPoint.renderedContent` — required HTML widget you MUST display per the Terms of Service
- `groundingChunks` — sources (URI + title)
- `groundingSupports` — spans of the answer linked to source indices

## Supported models

Current models use the `google_search` tool name (older models use `google_search_retrieval`):

- Gemini 3 family (3.5 Flash, 3.1 Flash-Lite, 3.1 Flash Image Preview, 3.1 Pro Preview, 3 Pro Image Preview, 3 Flash Preview)
- Gemini 2.5 family (Pro, Flash, Flash-Lite)
- `gemini-2.0-flash`

If a model returns "unknown tool" for `google_search`, try `google_search_retrieval` (older naming).

## Minimal call (Python)

```python
from google import genai
from google.genai import types

client = genai.Client()
config = types.GenerateContentConfig(
    tools=[types.Tool(google_search=types.GoogleSearch())],
)

r = client.models.generate_content(
    model="gemini-2.5-flash",
    contents="Who won the Euro 2024 final and by what score?",
    config=config,
)
print(r.text)
```

## Minimal call (JavaScript)

```javascript
import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({});

const r = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: "Who won the Euro 2024 final and by what score?",
  config: { tools: [{ googleSearch: {} }] },
});
console.log(r.text);
```

## Minimal call (cURL)

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{"parts":[{"text":"Who won the Euro 2024 final?"}]}],
    "tools": [{"google_search": {}}]
  }'
```

## Attaching citations to the response text

Out of the box, `r.text` is plain prose with no inline references. To produce text with markdown citations like `Spain won...[1](https://...)`, sort `groundingSupports` by `end_index` descending and splice in `[n](uri)` strings. Full helper in [citations.md](citations.md).

```python
from citations import add_citations  # see citations.md
text_with_refs = add_citations(r)
print(text_with_refs)
```

## Required: render the Search Suggestions widget

Google's Terms of Service for Grounding require displaying `groundingMetadata.searchEntryPoint.renderedContent` (an HTML + CSS snippet) somewhere in any UI that surfaces the response. Inject it as `dangerouslySetInnerHTML` / `innerHTML` in a sandboxed container.

```python
html = r.candidates[0].grounding_metadata.search_entry_point.rendered_content
```

For CLI usage where there's no UI, save the HTML alongside the answer under `gemini-output/grounded/` for traceability.

## Output conventions

Save the answer plus metadata under `gemini-output/grounded/`:

```
gemini-output/grounded/
  euro-2024-final_2026-05-21_143022.md          # answer + inline citations
  euro-2024-final_2026-05-21_143022.sources.json # raw groundingChunks
  euro-2024-final_2026-05-21_143022.widget.html  # rendered Search Suggestions
```

## Pricing

- **Gemini 3 models:** billed per **search query executed** (a single call may run multiple searches; each counts).
- **Gemini 2.5 and older:** billed per **prompt** (one request = one charge regardless of how many searches the model ran).
- Empty queries are not billed.

See the live pricing page for current rates: <https://ai.google.dev/gemini-api/docs/pricing>.

## Combining with other tools

On Gemini 3, `google_search` can be combined with:
- `url_context` — let the model fetch specific URLs you pass
- `code_execution` — run Python in a sandbox
- custom function calling

```python
config = types.GenerateContentConfig(tools=[
    types.Tool(google_search=types.GoogleSearch()),
    types.Tool(url_context=types.UrlContext()),
    types.Tool(code_execution=types.CodeExecution()),
])
```

**UNVERIFIED:** Exact constructor names for `UrlContext()` and `CodeExecution()` — confirm against the live SDK before pasting these.

## When to pick this vs Deep Research

| Use case | Skill |
|----------|-------|
| "Quick factual answer with sources" (seconds) | **gemini-google-search** |
| "Comprehensive research report with structured analysis" (minutes) | **gemini-deep-research** |

## When NOT to use

- The fact is in the model's training data and not time-sensitive → don't pay for a search.
- You already have URLs to read → use `url_context` tool directly (cheaper than letting the model search).
- You need a multi-page analyst-grade report → use **gemini-deep-research**.
