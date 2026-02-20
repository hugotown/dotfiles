---
name: gemini-deep-research
description: Executes autonomous multi-step research tasks using Gemini Deep Research Agent via Python SDK. Plans, searches the web, reads sources, and produces detailed cited reports. Supports multimodal inputs (images, PDFs, video), private data via file_search, streaming progress, and follow-up questions. Use when the user asks to research a topic, analyze competitors, write a report, conduct due diligence, literature review, market analysis, or any deep investigation task.
user-invocable: false
---

# Gemini Deep Research Agent

Autonomously plans, searches, reads, and synthesizes multi-step research tasks via Python SDK (Interactions API). Produces detailed, cited reports. Takes minutes, not seconds.

**Prerequisite:** GEMINI_API_KEY must be validated by the parent `gemini` skill before proceeding. Include the client boilerplate from the parent skill at the top of every script.

**Important:** Deep Research uses the **Interactions API** (`client.interactions`), NOT `generate_content`. It MUST run with `background=True`.

## Step 1: Select Agent

| Agent | ID | Description |
|-------|----|-------------|
| **Deep Research Pro** | `deep-research-pro-preview-12-2025` | Powered by Gemini 3 Pro. Web search + URL reading + optional file_search. |

Single agent available. No model selection needed.

## Step 2: Determine Input Type

| Input | Description |
|-------|-------------|
| **Text only** | Simple research query |
| **Text + formatting** | Query with output structure instructions |
| **Multimodal** | Text + images/PDFs/video for contextual research |
| **With private data** | Query + `file_search` tool for your own files |

## Step 3: Execute Research

### Basic Research (background polling)

```python
import time

interaction = client.interactions.create(
    input="YOUR RESEARCH QUERY HERE",
    agent="deep-research-pro-preview-12-2025",
    background=True,
)

print(f"Research started: {interaction.id}")

while True:
    interaction = client.interactions.get(interaction.id)
    if interaction.status == "completed":
        report = interaction.outputs[-1].text
        print(report)
        break
    elif interaction.status == "failed":
        print(f"Research failed: {interaction.error}")
        break
    print(f"Status: {interaction.status} — polling in 15s...")
    time.sleep(15)
```

### With Streaming (real-time progress)

```python
stream = client.interactions.create(
    input="YOUR RESEARCH QUERY HERE",
    agent="deep-research-pro-preview-12-2025",
    background=True,
    stream=True,
    agent_config={
        "type": "deep-research",
        "thinking_summaries": "auto",
    },
)

interaction_id = None
last_event_id = None

for chunk in stream:
    if chunk.event_type == "interaction.start":
        interaction_id = chunk.interaction.id
        print(f"Research started: {interaction_id}")

    if chunk.event_id:
        last_event_id = chunk.event_id

    if chunk.event_type == "content.delta":
        if chunk.delta.type == "text":
            print(chunk.delta.text, end="", flush=True)
        elif chunk.delta.type == "thought_summary":
            print(f"[Thought] {chunk.delta.content.text}", flush=True)

    elif chunk.event_type == "interaction.complete":
        print("\nResearch complete.")
```

### With Output Formatting

```python
prompt = """Research the competitive landscape of EV batteries.

Format the output as a technical report with:
1. Executive Summary
2. Key Players (include a data table comparing capacity and chemistry)
3. Supply Chain Risks"""

interaction = client.interactions.create(
    input=prompt,
    agent="deep-research-pro-preview-12-2025",
    background=True,
)
```

### With Multimodal Input (image + text)

```python
interaction = client.interactions.create(
    input=[
        {"type": "text", "text": "Analyze this image and research the subjects shown."},
        {"type": "image", "uri": "https://example.com/image.jpg"},
    ],
    agent="deep-research-pro-preview-12-2025",
    background=True,
)
```

### With Private Data (file_search)

```python
interaction = client.interactions.create(
    input="Compare our fiscal year report against current public web news.",
    agent="deep-research-pro-preview-12-2025",
    background=True,
    tools=[
        {"type": "file_search", "file_search_store_names": ["fileSearchStores/my-store-name"]}
    ],
)
```

### Follow-up Questions

After a completed research task, ask follow-ups using `previous_interaction_id`:

```python
followup = client.interactions.create(
    input="Can you elaborate on the second point in the report?",
    model="gemini-3.1-pro-preview",
    previous_interaction_id="COMPLETED_INTERACTION_ID",
)
print(followup.outputs[-1].text)
```

## Step 4: Handle Output — Return to Agent by Default

**Default behavior:** Print the research report text to stdout so the calling agent receives it directly. Do NOT save to a file unless the user explicitly requests it.

### Default: Return to Agent

```python
# After polling completes:
report = interaction.outputs[-1].text
print(report)
```

### Save to File (only when user requests)

**Default save directory:** `./gemini-skill/research/` (relative to the current project). Use a different path only if the user specifies one.

```python
import os
from datetime import datetime

report = interaction.outputs[-1].text

output_dir = "./gemini-skill/research"
os.makedirs(output_dir, exist_ok=True)
ts = datetime.now().strftime("%Y%m%d-%H%M%S")
path = f"{output_dir}/research-{ts}.md"

with open(path, "w") as f:
    f.write(report)

print(f"Report saved: {path}")
```

When saving, **remind the user** to add `gemini-skill/` to `.gitignore` if not already present.
**Always inform the user** of the interaction ID (for follow-ups).

## Step 5: Ask User for Next Action

After research completes, offer:
- Ask follow-up questions on the report
- Reformat or restructure the output
- Start a new research task
- Save report to file

## Prompting Best Practices

- **Be specific:** "Research the competitive landscape of solid-state EV batteries in 2025" not "research batteries"
- **Request structure:** Include formatting instructions directly in the prompt (sections, tables, tone)
- **Handle unknowns:** Add "If specific figures are not available, explicitly state they are projections or unavailable"
- **Provide context:** Ground the research with background info or constraints
- **Steer tone:** Specify "technical report", "executive summary", "casual blog post" etc.

For complete Python examples (streaming, reconnection, multimodal, follow-ups), read `examples.md` in this skill directory.

## Important Notes

- **Preview feature** — capabilities and pricing may change
- **Async only** — must use `background=True`, tasks take minutes (max 60 min, most < 20 min)
- **Interactions API** — uses `client.interactions`, NOT `client.models.generate_content`
- **Cost:** ~$2-3 per standard task, ~$3-5 per complex task
- **Default tools:** `google_search` and `url_context` enabled automatically (no config needed)
- **file_search:** Experimental — for private data, must specify tool explicitly
- **No custom tools:** Cannot use Function Calling or remote MCP servers
- **No audio input** — text, images, PDFs, and video only
- **Streaming:** Requires `stream=True` + `background=True` + `agent_config.thinking_summaries: "auto"` for thought progress
- **Follow-ups:** Use `previous_interaction_id` with a regular model (e.g., `gemini-3.1-pro-preview`), not the research agent
