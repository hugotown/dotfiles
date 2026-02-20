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

### 0b. Fetch Live Pricing

**MANDATORY** — Immediately after validating the API key, fetch current pricing:

```bash
curl -s https://ai.google.dev/gemini-api/docs/pricing.md.txt
```

Read the output and extract pricing for the models relevant to the user's task. You will use this data in Step 1 to select the most cost-effective model.

**Do NOT skip this step. Do NOT rely on memorized or hardcoded prices — they change frequently.**

## Step 1: Route to Sub-Skill and Select Model by Cost-Benefit

Determine the user's intent and load the appropriate sub-skill:

| User Intent | Sub-Skill | Read |
|-------------|-----------|------|
| Generate image, create picture, edit photo, design illustration, draw, create visual, style transfer, inpainting | **Nano Banana** (Image Generation) | `nano-banana/SKILL.md` |
| Text to speech, generate audio, voice, narration, podcast, audiobook, read aloud, TTS, speech synthesis | **Text-to-Speech** | `text-to-speech/SKILL.md` |
| Research a topic, write a report, analyze competitors, due diligence, literature review, market analysis, deep investigation, summarize findings | **Deep Research** | `deep-research/SKILL.md` |
| Search the web, current information, real-time data, fact-check, news, grounded answers with citations, verify claims | **Google Search** (Grounding) | `google-search/SKILL.md` |

**After routing:** Read the corresponding `SKILL.md` file from this skill's directory and follow its instructions completely. The API key is already validated.

### Model Selection: Cost-Benefit Analysis

**MANDATORY** — Using the live pricing from Step 0b, select the most appropriate model. NOT the cheapest, NOT the most expensive — the best **cost-benefit** for the specific task.

**Evaluation criteria (in order of priority):**

1. **Task compatibility** — Does the model support the required capability? (e.g., 4K images, Google Search grounding, multi-speaker TTS). Discard incompatible models.
2. **Task complexity** — Simple/routine tasks → cheaper model. Complex reasoning, text rendering in images, nuanced performances → pricier model justified.
3. **User instructions** — If the user requests a specific model or quality level, honor it. If they say "quick", "simple", "fast" → lean cheaper. If they say "high quality", "best" → lean pricier.
4. **Price delta** — If the cheaper model is adequate for the task, always prefer it. Only pay more when the price gap is justified by a clear capability difference the task needs.

**After selecting, briefly state the chosen model and why** (one line, e.g., "Using gemini-2.5-flash-image ($0.039/img) — task is simple text-to-image, Pro quality not needed").

## Available Capabilities

### Nano Banana - Image Generation (Python SDK)
- Text-to-image, image editing, style transfer, inpainting
- Multi-turn conversational editing (chat API handles thought signatures automatically)
- Up to 4K resolution, Google Search grounding
- Models: `gemini-2.5-flash-image`, `gemini-3-pro-image-preview` — selected by cost-benefit
- Output: `./gemini-skill/images/`

### Text-to-Speech (TTS) — Python SDK
- Single-speaker and multi-speaker (up to 2) audio generation
- 30 prebuilt voices with controllable style, accent, pace, tone
- Auto-plays audio by default; saves to `./gemini-skill/audio/` only when user requests
- Models: `gemini-2.5-flash-preview-tts`, `gemini-2.5-pro-preview-tts` — selected by cost-benefit

### Deep Research — Python SDK
- Autonomous multi-step research: plans, searches the web, reads sources, synthesizes reports
- Supports multimodal inputs (images, PDFs, video), private data via file_search
- Returns report directly to the agent by default; saves to `./gemini-skill/research/` only when user requests
- Agent: `deep-research-pro-preview-12-2025` (Interactions API) — verify cost before starting

### Google Search (Grounding) — Python SDK
- Real-time web grounding for factual, cited responses
- Inline citations with source attribution (`grounding_metadata`)
- Always returns results directly to the agent (never saves to file)
- Models: `gemini-3-flash-preview`, `gemini-3-pro-preview`, `gemini-2.5-flash`, `gemini-2.5-pro` — selected by cost-benefit
