# Gemini — Model Picker

Pick the smallest model that covers the capability, then go bigger if quality is insufficient.

## Text + multimodal (general use)

Verified live via `client.models.list()` on 2026-05-22 with a standard developer key:

| Goal | Model | Notes |
|------|-------|-------|
| Cheap general chat, captions, classification | `gemini-2.5-flash` | Good baseline. Image + text input supported. |
| Higher quality reasoning, longer context | `gemini-2.5-pro` | More expensive, better synthesis. |
| Lightest/fastest | `gemini-2.5-flash-lite` | When latency matters more than quality. |
| Newest stable Flash | `gemini-3.5-flash` | Live. Default for image-understanding and document docs. |
| Always-latest aliases | `gemini-flash-latest`, `gemini-pro-latest`, `gemini-flash-lite-latest` | Convenient but drift across releases — pin a numbered version in production. |
| Preview 3.x family | `gemini-3-flash-preview`, `gemini-3-pro-preview`, `gemini-3.1-flash-lite-preview`, `gemini-3.1-pro-preview` | Preview tier. |
| TTS | `gemini-2.5-flash-preview-tts`, `gemini-2.5-pro-preview-tts`, `gemini-3.1-flash-tts-preview` | Speech output. |
| Live (bidi audio) | `gemini-2.5-flash-native-audio-*`, `gemini-3.1-flash-live-preview` | Real-time audio I/O via `bidiGenerateContent`. |
| Embeddings | `gemini-embedding-001`, `gemini-embedding-2`, `gemini-embedding-2-preview` | |

## Image generation ("nano banana")

| Model | When to pick |
|-------|--------------|
| `gemini-2.5-flash-image` | High-volume, low-latency. Fixed 1024px output. |
| `gemini-3-pro-image-preview` | Professional asset production. Up to 4K. Up to 14 reference images. |
| `gemini-3.1-flash-image-preview` | Best speed/quality balance. Up to 4K, up to 14 ref images. |
| `imagen-4` | Specialized Imagen pipeline (separate model family). |

Full parameter ranges (aspect ratios, sizes) in **gemini-image-generation** skill.

## Image understanding (vision input)

All Gemini 2.5 and 3.x models accept image input. Use `gemini-2.5-flash` by default; switch to `gemini-2.5-pro` for hard OCR or fine-grained spatial reasoning.

## Document / PDF processing

Same models as image understanding. `gemini-2.5-flash` for most cases; `gemini-2.5-pro` for very long documents (up to 1000 pages, 50MB).

## Google Search grounding

Supported on the 2.0, 2.5, and 3.x families. See **gemini-google-search** skill for the exact supported list (older models use `google_search_retrieval`; current models use `google_search`).

## Deep Research

Verified live on 2026-05-22 via the `client.interactions` surface in `google-genai==1.66.0` (warning: experimental):

- `deep-research-preview-04-2026` — default
- `deep-research-pro-preview-12-2025` — newer pro tier
- `deep-research-max-preview-04-2026` — max comprehensiveness

See **gemini-deep-research** skill for usage.

## Listing live models

```python
from google import genai
client = genai.Client()
for m in client.models.list():
    print(m.name, "—", getattr(m, "supported_actions", ""))
```

Run this when a model ID returns `NotFound`. The output is the source of truth for what your key can call right now.
