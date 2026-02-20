# Complete Deep Research Python SDK Examples

All examples use `google-genai` SDK. Include the client boilerplate (API key loading + `genai.Client`) before running.

## Client Boilerplate

```python
import os, sys

api_key = None
if os.path.exists('.env'):
    with open('.env') as f:
        for line in f:
            if line.startswith('GEMINI_API_KEY='):
                api_key = line.split('=', 1)[1].strip().strip('"').strip("'")
                break
if not api_key:
    api_key = os.environ.get('GEMINI_API_KEY')
if not api_key:
    print("ERROR: GEMINI_API_KEY not found.")
    sys.exit(1)

from google import genai
client = genai.Client(api_key=api_key)
```

## Basic Research with Polling

```python
import time

interaction = client.interactions.create(
    input="Research the history of Google TPUs.",
    agent="deep-research-pro-preview-12-2025",
    background=True,
)

print(f"Research started: {interaction.id}")

while True:
    interaction = client.interactions.get(interaction.id)
    if interaction.status == "completed":
        print(interaction.outputs[-1].text)
        break
    elif interaction.status == "failed":
        print(f"Research failed: {interaction.error}")
        break
    print(f"Status: {interaction.status} — polling in 15s...")
    time.sleep(15)
```

## Streaming with Real-Time Progress

```python
stream = client.interactions.create(
    input="Research the competitive landscape of EV batteries.",
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

## Reconnecting to a Dropped Stream

```python
import time

interaction_id = "SAVED_INTERACTION_ID"
last_event_id = "SAVED_LAST_EVENT_ID"
is_complete = False

def process_stream(event_stream):
    global last_event_id, is_complete
    for event in event_stream:
        if event.event_id:
            last_event_id = event.event_id

        if event.event_type == "content.delta":
            if event.delta.type == "text":
                print(event.delta.text, end="", flush=True)
            elif event.delta.type == "thought_summary":
                print(f"[Thought] {event.delta.content.text}", flush=True)

        if event.event_type in ["interaction.complete", "error"]:
            is_complete = True

while not is_complete:
    try:
        resume_stream = client.interactions.get(
            id=interaction_id,
            stream=True,
            last_event_id=last_event_id,
        )
        process_stream(resume_stream)
    except Exception as e:
        print(f"\nReconnecting... ({e})")
        time.sleep(2)
```

## Structured Output (Report Format)

```python
prompt = """Research the competitive landscape of EV batteries.

Format the output as a technical report with the following structure:
1. Executive Summary
2. Key Players (Must include a data table comparing capacity and chemistry)
3. Supply Chain Risks
4. Future Outlook

If specific 2025 figures are not available, explicitly state they are projections."""

interaction = client.interactions.create(
    input=prompt,
    agent="deep-research-pro-preview-12-2025",
    background=True,
)
# ... poll for results ...
```

## Multimodal Input (Image + Text)

```python
interaction = client.interactions.create(
    input=[
        {
            "type": "text",
            "text": "Analyze the interspecies dynamics in this image. Research the symbiotic relationships between the species shown and assess behavioral risks.",
        },
        {
            "type": "image",
            "uri": "https://storage.googleapis.com/generativeai-downloads/images/generated_elephants_giraffes_zebras_sunset.jpg",
        },
    ],
    agent="deep-research-pro-preview-12-2025",
    background=True,
)
# ... poll for results ...
```

## With Private Data (file_search)

```python
interaction = client.interactions.create(
    input="Compare our 2025 fiscal year report against current public web news about our industry.",
    agent="deep-research-pro-preview-12-2025",
    background=True,
    tools=[
        {"type": "file_search", "file_search_store_names": ["fileSearchStores/my-store-name"]}
    ],
)
# ... poll for results ...
```

## Follow-up Questions

```python
followup = client.interactions.create(
    input="Can you elaborate on the second point in the report?",
    model="gemini-3.1-pro-preview",
    previous_interaction_id="COMPLETED_INTERACTION_ID",
)
print(followup.outputs[-1].text)
```

## Save Report to File (when user requests)

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

## Full Helper: Research with Polling

```python
import time

def run_research(query, save_path=None):
    """Run deep research. Returns report text. Optionally saves to file."""
    interaction = client.interactions.create(
        input=query,
        agent="deep-research-pro-preview-12-2025",
        background=True,
    )
    print(f"Research started: {interaction.id}")

    while True:
        interaction = client.interactions.get(interaction.id)
        if interaction.status == "completed":
            report = interaction.outputs[-1].text
            if save_path:
                os.makedirs(os.path.dirname(save_path) or ".", exist_ok=True)
                with open(save_path, "w") as f:
                    f.write(report)
                print(f"Report saved: {save_path}")
            else:
                print(report)
            print(f"Interaction ID (for follow-ups): {interaction.id}")
            return report
        elif interaction.status == "failed":
            print(f"Research failed: {interaction.error}")
            return None
        print(f"  Status: {interaction.status}")
        time.sleep(15)

# Usage:
# run_research("Research the history of quantum computing")
# run_research("Analyze EV battery market", save_path="./gemini-skill/research/ev-batteries.md")
```
