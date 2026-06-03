# Google Search Grounding — Citation Helpers

## `groundingMetadata` structure

```jsonc
{
  "webSearchQueries": ["UEFA Euro 2024 winner", "who won euro 2024"],
  "searchEntryPoint": {
    "renderedContent": "<!-- HTML + CSS for the required Search Suggestions widget -->"
  },
  "groundingChunks": [
    { "web": { "uri": "https://aljazeera.com/...", "title": "aljazeera.com" } },
    { "web": { "uri": "https://...",              "title": "..." } }
  ],
  "groundingSupports": [
    {
      "segment": { "startIndex": 0, "endIndex": 85, "text": "Spain won Euro 2024..." },
      "groundingChunkIndices": [0]
    }
  ]
}
```

| Field | Purpose |
|-------|---------|
| `webSearchQueries` | What the model actually searched for. Show to user for transparency. |
| `searchEntryPoint.renderedContent` | HTML widget you MUST display (ToS requirement). |
| `groundingChunks[i].web.uri` / `.title` | The source for citation `[i+1]`. |
| `groundingSupports[].segment.{startIndex,endIndex,text}` | UTF-8 character offsets into `response.text` that this support covers. |
| `groundingSupports[].groundingChunkIndices` | Which `groundingChunks` back this span. |

## Python — splice citations into `response.text`

```python
def add_citations(response) -> str:
    """Return response.text with [n](uri) markdown citations appended after each grounded span."""
    text = response.text
    md = response.candidates[0].grounding_metadata
    if not md or not md.grounding_supports:
        return text

    supports = md.grounding_supports
    chunks   = md.grounding_chunks

    # Splice from right to left so earlier indices don't shift.
    for support in sorted(supports, key=lambda s: s.segment.end_index, reverse=True):
        end = support.segment.end_index
        if not support.grounding_chunk_indices:
            continue
        cites = []
        for i in support.grounding_chunk_indices:
            if i < len(chunks):
                cites.append(f"[{i + 1}]({chunks[i].web.uri})")
        text = text[:end] + " " + ", ".join(cites) + text[end:]
    return text
```

## JavaScript — same helper

```javascript
export function addCitations(response) {
  let text = response.text;
  const md = response.candidates?.[0]?.groundingMetadata;
  if (!md?.groundingSupports?.length) return text;

  const supports = md.groundingSupports;
  const chunks = md.groundingChunks;

  // Right-to-left so earlier indices don't shift.
  const ordered = [...supports].sort(
    (a, b) => (b.segment?.endIndex ?? 0) - (a.segment?.endIndex ?? 0)
  );

  for (const s of ordered) {
    const end = s.segment?.endIndex;
    const idx = s.groundingChunkIndices;
    if (end === undefined || !idx?.length) continue;

    const cites = idx
      .map(i => chunks[i]?.web?.uri ? `[${i + 1}](${chunks[i].web.uri})` : null)
      .filter(Boolean);

    if (cites.length) text = text.slice(0, end) + " " + cites.join(", ") + text.slice(end);
  }
  return text;
}
```

## Saving sources alongside the answer

```python
import json, pathlib
from datetime import datetime

slug, stamp = "euro-2024-final", datetime.now().strftime("%Y-%m-%d_%H%M%S")
base = pathlib.Path("gemini-output/grounded")
base.mkdir(parents=True, exist_ok=True)

# 1. Answer with inline citations
(base / f"{slug}_{stamp}.md").write_text(add_citations(r))

# 2. Raw sources for traceability
md = r.candidates[0].grounding_metadata
sources = [
    {"index": i + 1, "uri": c.web.uri, "title": c.web.title}
    for i, c in enumerate(md.grounding_chunks)
]
(base / f"{slug}_{stamp}.sources.json").write_text(json.dumps(sources, indent=2))

# 3. Required Search Suggestions HTML widget (ToS)
(base / f"{slug}_{stamp}.widget.html").write_text(md.search_entry_point.rendered_content)
```

## Notes

- `groundingSupports` uses character offsets into `response.text`. If you've modified the text before splicing (e.g. trimmed whitespace), reset offsets first or splice into the original string.
- `webSearchQueries` is also worth logging — it shows what the model translated the user's question into.
- For multilingual answers, the offsets are over Unicode code points / characters, not bytes.
