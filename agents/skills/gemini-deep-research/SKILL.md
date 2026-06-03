---
name: gemini-deep-research
description: Use when running multi-step, agentic, analyst-grade research with Gemini Deep Research. Triggers — "gemini deep research", "investigación profunda", "do deep research on X", "produce a market analysis", "write a competitive landscape report", "due diligence on company X", "deep dive into topic Y with sources", "research report", "multi-source synthesis". Long-running (minutes to ~60 min), autonomously plans + executes + synthesizes, produces long-form reports with citations. Different from gemini-google-search (one-shot grounded answer in seconds).
---

# Gemini Deep Research — Agentic Multi-Step Research

Source: <https://ai.google.dev/gemini-api/docs/interactions/deep-research>

**REQUIRED BACKGROUND:** `gemini-common`.

## SDK status (verified `google-genai==1.66.0`, 2026-05-22)

`client.interactions` exists with methods: `create`, `get`, `cancel`, `delete`, `with_raw_response`, `with_streaming_response`. The SDK emits this warning on first use:

> `UserWarning: Interactions usage is experimental and may change in future versions.`

Treat the surface as **experimental** — fields and event shapes may change between SDK releases. Pin a SDK version in production.

## Available agents (verified via `client.models.list()` on 2026-05-22)

| Agent | Confirmed |
|-------|-----------|
| `deep-research-preview-04-2026` | ✓ |
| `deep-research-max-preview-04-2026` | ✓ |
| `deep-research-pro-preview-12-2025` | ✓ (NEWER, not in original docs page — try this for highest quality) |

## Quick Reference

| File | Contents |
|------|----------|
| [streaming.md](streaming.md) | Full streaming + reconnection example (Python + JS), saving incremental text/thoughts/images to disk. |

## Agents — when to pick which

| Agent ID | When |
|----------|------|
| `deep-research-preview-04-2026` | Default. Speed-optimized, streamable. |
| `deep-research-pro-preview-12-2025` | Newer "pro" tier; try first for quality. |
| `deep-research-max-preview-04-2026` | Max comprehensiveness. ~2× cost and time. Pick for serious due diligence. |

Cost estimates from the docs:

| Agent | Searches | Input tok | Output tok | Cost |
|-------|----------|-----------|------------|------|
| Deep Research | ~80 | ~250k | ~60k | $1–$3 |
| Deep Research Max | ~160 | ~900k | ~80k | $3–$7 |

50-70% of input tokens are typically cached. Hard ceiling: 60 minutes per task (typical ~20 min).

## Minimal blocking call (Python) — verified signature

The `interactions.create` signature is **flat** (parameters at top level), unlike `generate_content` which nests everything under `config=`:

```python
from google import genai
import time, warnings
warnings.filterwarnings("ignore")  # silence experimental warning

client = genai.Client()

interaction = client.interactions.create(
    input="Research the competitive landscape of quantum computing startups in 2025.",
    agent="deep-research-preview-04-2026",
    background=True,   # REQUIRED for Deep Research
    store=True,        # required when background=True (usually default)
    agent_config={"type": "deep-research", "thinking_summaries": "auto"},
)

print("interaction id:", interaction.id)
while True:
    cur = client.interactions.get(interaction.id)
    if cur.status == "completed":
        print(cur.output_text)
        break
    if cur.status in ("failed", "errored"):
        print("FAILED:", getattr(cur, "error", None))
        break
    time.sleep(10)
```

`background=True` is mandatory; the task runs server-side and you poll. Without it, the request times out long before the agent finishes.

## Minimal blocking call (JavaScript)

```javascript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({});

const i = await ai.interactions.create({
  input: "Competitive landscape of quantum computing startups in 2025.",
  agent: "deep-research-preview-04-2026",
  background: true,
});

console.log("id:", i.id);
while (true) {
  const cur = await ai.interactions.get(i.id);
  if (cur.status === "completed") { console.log(cur.output_text); break; }
  if (cur.status === "failed")    { console.log("FAILED:", cur.error); break; }
  await new Promise(r => setTimeout(r, 10000));
}
```

## `agent_config` parameters

Verified against `types.DeepResearchAgentConfig.model_fields` in `google-genai==1.66.0`. **Only two fields exist** — the original docs page suggested `visualization` and `collaborative_planning` but those do NOT exist in this SDK class.

| Field | Type | Default | Use |
|-------|------|---------|-----|
| `type` | `Literal["deep-research"]` | required | Must be exactly `"deep-research"` |
| `thinking_summaries` | `Literal["auto", "none"] \| None` | `None` (≈ none) | `"auto"` to stream intermediate reasoning |

## `tools` (override default toolset)

Verified tool TypedDicts in the interactions API (different from `generate_content`'s `types.Tool` wrapper — here you pass plain dicts with a `type` discriminator):

| Tool | Shape |
|------|-------|
| Google Search | `{"type": "google_search"}` (optional `search_types` field for filtering) |
| URL Context | `{"type": "url_context"}` |
| Code Execution | `{"type": "code_execution"}` |
| MCP Server | `{"type": "mcp_server", ...}` |
| File Search | `{"type": "file_search", ...}` |
| Computer Use | `{"type": "computer_use", ...}` |
| Function calling | custom `FunctionParam` shape |

By default the Deep Research agent uses Google Search + URL Context + Code Execution; override or extend:

```python
tools=[
    {"type": "google_search"},
    {"type": "url_context"},
    {"type": "code_execution"},
]
```

## Output

```python
final = client.interactions.get(interaction.id)

final.output_text      # the synthesized report (Markdown-friendly long-form text)
final.steps            # array of execution steps the agent took
final.id               # interaction id (use to continue / re-fetch)
final.error            # populated only on FAILED
```

## Output conventions

Save under `gemini-output/research/` with the slug + timestamp pattern:

```
gemini-output/research/
  quantum-startups-2025_2026-05-21_091500.md         # final report (output_text)
  quantum-startups-2025_2026-05-21_091500.json       # metadata: interaction_id, agent, status, query, steps_count
  quantum-startups-2025_2026-05-21_091500.thoughts.txt # thinking summaries (only when thinking_summaries="auto")
  quantum-startups-2025_2026-05-21_091500.images/    # any generated charts
```

Full saving recipe (with streaming + reconnect) in [streaming.md](streaming.md).

## The ask-vs-direct rule applied here

| User said | Action |
|-----------|--------|
| "Quick deep research on quantum startups, default settings" | Direct → `deep-research-preview-04-2026`, default config. |
| "Comprehensive due diligence on Anthropic for an investor memo" | Suggest+ask: `deep-research-max-preview-04-2026`, `thinking_summaries=auto`, `visualization=auto`. |
| "Deep research on X" (no other context) | Ask: max comprehensiveness or quick? Streaming? Default offered: preview agent, streamed. |
| "I have a $20 budget" | Choose agent based on the cost table; if budget < $3, only `deep-research-preview-04-2026` makes sense. |

## Continuing a previous research

```python
followup = client.interactions.create(
    input="Now narrow to startups with $20M+ raised in 2024-2025.",
    agent="deep-research-preview-04-2026",
    previous_interaction_id=interaction.id,
    background=False,  # follow-ups are often quick enough to be sync
)
print(followup.output_text)
```

## Streaming intermediate steps

Set `stream=True` and `thinking_summaries="auto"`. The stream may drop on long tasks — implement reconnection using `last_event_id`. Full recipe in [streaming.md](streaming.md).

## Hard limits

- Max wall-clock per task: **60 minutes** (typical ~20 min)
- `store=True` is required when `background=True` (usually default; pass explicitly when in doubt)
- Streaming requires both `stream=True` and `background=True`
- The interaction's `response_modalities` enum uses **lowercase** strings (`'text'`, `'image'`, `'audio'`) — different from `generate_content` which uses uppercase (`'TEXT'`, `'IMAGE'`).
- The SDK emits `UserWarning: Interactions usage is experimental` on first use. Silence with `warnings.filterwarnings("ignore")` if needed.

## When NOT to use

- Simple factual question → **gemini-google-search** (seconds, ~$0.01)
- You already have all the source documents → **gemini-document-processing** with multi-doc input is cheaper
- You need an image → **gemini-image-generation** (with `tools=[{google_search: {}}]` if you need current-events data)
