---
name: gemini-google-search
description: Grounds Gemini responses with real-time Google Search results via Python SDK. Provides factual, cited answers with inline source attribution. Use when the user needs current information, fact-checked answers, real-time data, news, or any query that benefits from web grounding. Keywords: search, grounding, citations, real-time, current, news, fact-check, web search, sources.
user-invocable: false
---

# Gemini Google Search Grounding

Connects Gemini to real-time web content for accurate, cited responses via Python SDK (`google-genai`). The model automatically generates search queries, processes results, and returns grounded answers with source attribution.

**Prerequisite:** GEMINI_API_KEY must be validated by the parent `gemini` skill before proceeding. Include the client boilerplate from the parent skill at the top of every script.

**Output:** NEVER save results to files. Always return the answer text and sources directly to the calling agent.

## Step 1: Select Model (Cost-Benefit)

Use the live pricing fetched in the parent skill's Step 0b. Available models for Google Search grounding:

| Model | ID | Strengths |
|-------|----|-----------|
| **Gemini 3 Flash** | `gemini-3-flash-preview` | Fast, intelligent, cheap tokens. Search billed per query. |
| **Gemini 3 Pro** | `gemini-3-pro-preview` | Best reasoning quality. Search billed per query. |
| **Gemini 2.5 Flash** | `gemini-2.5-flash` | Stable, production-ready, cheap tokens. Search billed per prompt. |
| **Gemini 2.5 Pro** | `gemini-2.5-pro` | Strong reasoning. Search billed per prompt. |

**Selection criteria:**
- **Simple factual queries** (weather, quick facts, news) → cheapest adequate model
- **Multi-step reasoning with search** (analysis, comparison, synthesis) → mid-tier model
- **Complex reasoning + search** (deep analysis, multi-source synthesis) → Pro-tier justified
- **User requests specific model or quality** → honor it

**Billing difference:** Gemini 3 models bill per individual search query executed (a single prompt may trigger multiple queries). Gemini 2.5 models bill per grounded prompt regardless of query count. Factor this into cost evaluation.

**State your choice and reasoning** (one line) before proceeding.

## Step 2: Execute Grounded Search

### Basic Search

```python
from google.genai import types

response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents="YOUR QUERY HERE",
    config=types.GenerateContentConfig(
        tools=[types.Tool(google_search=types.GoogleSearch())]
    ),
)
print(response.text)
```

### With URL Context (search + specific URLs)

```python
from google.genai import types

response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents="Summarize the latest updates from this page and compare with current news.",
    config=types.GenerateContentConfig(
        tools=[
            types.Tool(google_search=types.GoogleSearch()),
            types.Tool(url_context=types.UrlContext(urls=["https://example.com/page"])),
        ]
    ),
)
print(response.text)
```

### With Code Execution

```python
from google.genai import types

response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents="Search for the latest GDP figures of G7 countries and create a comparison.",
    config=types.GenerateContentConfig(
        tools=[
            types.Tool(google_search=types.GoogleSearch()),
            types.Tool(code_execution=types.ToolCodeExecution()),
        ]
    ),
)
for part in response.candidates[0].content.parts:
    if hasattr(part, "text") and part.text:
        print(part.text)
```

## Step 3: Extract and Return Response with Sources

**Always return results directly to the agent.** Extract answer + sources and print them.

```python
# Print answer
print(response.text)

# Extract grounding metadata
gm = response.candidates[0].grounding_metadata

if gm:
    if gm.web_search_queries:
        print("\nSearch queries:")
        for q in gm.web_search_queries:
            print(f"- {q}")

    if gm.grounding_chunks:
        print("\nSources:")
        for chunk in gm.grounding_chunks:
            if chunk.web:
                print(f"- [{chunk.web.title}]({chunk.web.uri})")
```

### Inline Citations (optional, for rich output)

```python
def add_citations(response):
    text = response.text
    supports = response.candidates[0].grounding_metadata.grounding_supports
    chunks = response.candidates[0].grounding_metadata.grounding_chunks

    sorted_supports = sorted(supports, key=lambda s: s.segment.end_index, reverse=True)

    for support in sorted_supports:
        end_index = support.segment.end_index
        if support.grounding_chunk_indices:
            links = []
            for i in support.grounding_chunk_indices:
                if i < len(chunks):
                    uri = chunks[i].web.uri
                    links.append(f"[{i + 1}]({uri})")
            text = text[:end_index] + " " + ", ".join(links) + text[end_index:]

    return text

print(add_citations(response))
```

## Response Structure

The `grounding_metadata` object contains:

| Field | Description |
|-------|-------------|
| `web_search_queries` | Search queries the model generated and executed |
| `search_entry_point` | HTML/CSS for rendering Search Suggestions widget |
| `grounding_chunks` | Source URLs with titles |
| `grounding_supports` | Maps text segments to source indices (for inline citations) |

## Important Notes

- **No file output** — always return results directly to the agent
- **Real-time data** — responses reflect current web content, not just training data
- **Auto-search** — the model decides when and how many searches to run
- **Multiple queries** — a single prompt may trigger multiple search queries
- **Citations** — always present grounding sources to the user
- **Billing (Gemini 3):** Per unique search query executed (multiple queries per prompt possible)
- **Billing (Gemini 2.5/older):** Per prompt, regardless of query count
- **Combinable tools:** Works with `url_context` and `code_execution`
- **No `google_search_retrieval`** — older tool name, use `google_search` for all current models

For complete Python examples (multi-tool, inline citations), read `examples.md` in this skill directory.
