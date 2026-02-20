---
name: gemini
description: Gemini API skills hub for image generation, text-to-speech, deep research, and Google Search grounding via Python SDK. Routes to sub-skills based on user intent. Use when the user asks to generate images, edit photos, create audio, convert text to speech, generate voice, produce podcasts, research a topic, write a report, conduct analysis, search the web, get current information, fact-check, or any Gemini API task. Keywords: image, picture, photo, illustration, generate, create, edit, draw, design, audio, voice, speech, TTS, narrate, read aloud, podcast, audiobook, research, report, analysis, investigate, due diligence, literature review, market analysis, competitive analysis, deep research, search, grounding, real-time, current, news, fact-check, citations, web search, Gemini, Nano Banana.
---

# Gemini API Skills

Hub for Gemini API capabilities via Python SDK (`google-genai`). Routes to the appropriate sub-skill based on user intent.

## Step 0: Validate Environment

**MANDATORY FIRST ACTION** before any API call:

### 0a. Validate GEMINI_API_KEY

Packages `google-genai` and `Pillow` are installed globally via mise postinstall (`~/.config/mise/config.toml`).

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
    print("Set it in your project .env: GEMINI_API_KEY=your-key-here")
    print("Or export: export GEMINI_API_KEY=your-key-here")
    sys.exit(1)

from google import genai
client = genai.Client(api_key=api_key)
```

This boilerplate must be included at the top of every Python script. Sub-skills reference it as "the client boilerplate".

## Step 1: Route to Sub-Skill

Determine the user's intent and load the appropriate sub-skill:

| User Intent | Sub-Skill | Read |
|-------------|-----------|------|
| Generate image, create picture, edit photo, design illustration, draw, create visual, style transfer, inpainting | **Nano Banana** (Image Generation) | `nano-banana/SKILL.md` |
| Text to speech, generate audio, voice, narration, podcast, audiobook, read aloud, TTS, speech synthesis | **Text-to-Speech** | `text-to-speech/SKILL.md` |
| Research a topic, write a report, analyze competitors, due diligence, literature review, market analysis, deep investigation, summarize findings | **Deep Research** | `deep-research/SKILL.md` |
| Search the web, current information, real-time data, fact-check, news, grounded answers with citations, verify claims | **Google Search** (Grounding) | `google-search/SKILL.md` |

**After routing:** Read the corresponding `SKILL.md` file from this skill's directory and follow its instructions completely. The API key is already validated.

## Available Capabilities

### Nano Banana - Image Generation (Python SDK)
- Text-to-image, image editing, style transfer, inpainting
- Multi-turn conversational editing (chat API handles thought signatures automatically)
- Up to 4K resolution, Google Search grounding
- Models: `gemini-3-pro-image-preview` (default), `gemini-2.5-flash-image`
- Output: `./gemini-skill/images/`

### Text-to-Speech (TTS) — Python SDK
- Single-speaker and multi-speaker (up to 2) audio generation
- 30 prebuilt voices with controllable style, accent, pace, tone
- Auto-plays audio by default; saves to `./gemini-skill/audio/` only when user requests
- Models: `gemini-2.5-flash-preview-tts` (default), `gemini-2.5-pro-preview-tts`

### Deep Research — Python SDK
- Autonomous multi-step research: plans, searches the web, reads sources, synthesizes reports
- Supports multimodal inputs (images, PDFs, video), private data via file_search
- Returns report directly to the agent by default; saves to `./gemini-skill/research/` only when user requests
- Agent: `deep-research-pro-preview-12-2025` (Interactions API)

### Google Search (Grounding) — Python SDK
- Real-time web grounding for factual, cited responses
- Inline citations with source attribution (`grounding_metadata`)
- Always returns results directly to the agent (never saves to file)
- Models: `gemini-3-flash-preview` (default), `gemini-3-pro-preview`, `gemini-2.5-flash`, `gemini-2.5-pro`
