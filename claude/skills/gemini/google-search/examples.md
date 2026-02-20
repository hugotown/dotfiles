# Complete Google Search Grounding Python SDK Examples

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
from google.genai import types

client = genai.Client(api_key=api_key)
```

## Basic Grounded Query

```python
response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents="Who won the euro 2024?",
    config=types.GenerateContentConfig(
        tools=[types.Tool(google_search=types.GoogleSearch())]
    ),
)
print(response.text)
```

## With Higher Quality Model

```python
response = client.models.generate_content(
    model="gemini-3-pro-preview",
    contents="What are the latest developments in quantum computing in 2026?",
    config=types.GenerateContentConfig(
        tools=[types.Tool(google_search=types.GoogleSearch())]
    ),
)
print(response.text)
```

## Combined: Google Search + URL Context

```python
response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents="Compare the information on this page with the latest news about the same topic.",
    config=types.GenerateContentConfig(
        tools=[
            types.Tool(google_search=types.GoogleSearch()),
            types.Tool(url_context=types.UrlContext(urls=["https://example.com/article"])),
        ]
    ),
)
print(response.text)
```

## Combined: Google Search + Code Execution

```python
response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents="Search for the current stock prices of AAPL, GOOGL, and MSFT, then calculate the average.",
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

## Extract Full Grounding Metadata

```python
response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents="What is the current weather in Tokyo?",
    config=types.GenerateContentConfig(
        tools=[types.Tool(google_search=types.GoogleSearch())]
    ),
)

print("=== Answer ===")
print(response.text)

gm = response.candidates[0].grounding_metadata

if gm:
    if gm.web_search_queries:
        print("\n=== Search Queries ===")
        for q in gm.web_search_queries:
            print(f"- {q}")

    if gm.grounding_chunks:
        print("\n=== Sources ===")
        for chunk in gm.grounding_chunks:
            if chunk.web:
                print(f"- [{chunk.web.title}]({chunk.web.uri})")

    if gm.grounding_supports:
        print(f"\n=== Citations: {len(gm.grounding_supports)} segments mapped to sources ===")
```

## Inline Citations

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

response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents="Who won the 2024 Nobel Prize in Physics?",
    config=types.GenerateContentConfig(
        tools=[types.Tool(google_search=types.GoogleSearch())]
    ),
)
print(add_citations(response))
```

## Multi-turn Conversation with Search

```python
chat = client.chats.create(
    model="gemini-3-flash-preview",
    config=types.GenerateContentConfig(
        tools=[types.Tool(google_search=types.GoogleSearch())]
    ),
)

# Turn 1
response1 = chat.send_message("What are the top AI companies in 2026?")
print(response1.text)

# Turn 2: Follow-up
response2 = chat.send_message("Tell me more about the top 3 and their latest funding rounds.")
print(response2.text)
```

## Search Helper

```python
def grounded_search(query, model="gemini-3-flash-preview"):
    """Run a grounded search and return answer + sources."""
    response = client.models.generate_content(
        model=model,
        contents=query,
        config=types.GenerateContentConfig(
            tools=[types.Tool(google_search=types.GoogleSearch())]
        ),
    )

    print(response.text)

    gm = response.candidates[0].grounding_metadata
    if gm and gm.grounding_chunks:
        print("\nSources:")
        for chunk in gm.grounding_chunks:
            if chunk.web:
                print(f"- [{chunk.web.title}]({chunk.web.uri})")

    return response

# Usage:
# grounded_search("Latest news about SpaceX Starship")
# grounded_search("Compare React vs Vue in 2026", model="gemini-3-pro-preview")
```
