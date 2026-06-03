---
name: gemini-common
description: "Use when working with ANY Gemini API skill (image generation/nano banana, image understanding, document/PDF processing, Google Search grounding, Deep Research). Provides shared setup: API key location, SDK install (Python/JS), model picker, output folder conventions (gemini-output/), and the ask-vs-direct rule for parameter defaults."
---

# Gemini Common — Shared Setup & Conventions

Base reference loaded by every other `gemini-*` skill. Keep this open whenever you assist with Gemini features.

## Quick Reference

| Topic | File |
|-------|------|
| API key, where it lives, how to verify | [setup.md](setup.md) |
| SDK install per language (Python, JS, Go, Java) | [setup.md](setup.md) |
| Which model to pick for which task | [models.md](models.md) |
| Where generated artifacts must be saved | [output-conventions.md](output-conventions.md) |

## The Ask-vs-Direct Rule (CRITICAL)

When a user requests a Gemini operation that has parameters (aspect ratio, resolution, style, number of pages, depth of research, etc.):

1. **If the user explicitly supplied the parameter values, go direct.** Don't ask. Don't second-guess.
2. **If the user did NOT supply values but the request implies obvious defaults from context, SUGGEST and ASK before running.**
   - "post for Facebook" → suggest `1:1` aspect ratio, 1K
   - "cover for Facebook page" → suggest `16:9` (landscape), 2K
   - "Instagram story" → suggest `9:16`, 1K
   - "wallpaper 4K" → suggest `16:9`, 4K
3. **If the request is ambiguous AND has no contextual default, ASK.** Don't pick silently.

Asking is done with the question tool (per user's global rule). One question, with the suggestion as the first option.

## Output Folder Convention

Every artifact-producing Gemini skill MUST save outputs under `gemini-output/<category>/` in the current working directory. Categories:

- `gemini-output/images/` — generated/edited images
- `gemini-output/research/` — deep research reports + sources
- `gemini-output/documents/` — extracted/summarized content from PDFs
- `gemini-output/vision/` — image-understanding outputs (annotated images, JSON detections)
- `gemini-output/grounded/` — Google-Search-grounded responses with citations
- `gemini-output/audio/` — reserved for future audio outputs

Filename format: `<short-slug>_<YYYY-MM-DD>_<HHMMSS>.<ext>`. See [output-conventions.md](output-conventions.md) for the exact convention and the helper snippet.

## Authentication (One-Liner)

All SDKs read `GEMINI_API_KEY` from the environment. Verify with:

```bash
[ -n "$GEMINI_API_KEY" ] && echo "API key present (${#GEMINI_API_KEY} chars)" || echo "MISSING: export GEMINI_API_KEY=..."
```

If missing, see [setup.md](setup.md) for where to get the key and how to set it.

## Cross-References to Other Gemini Skills

- **gemini-libraries** — installing/configuring the SDK from scratch
- **gemini-image-generation** — generating images (nano banana, all aspect ratios/resolutions)
- **gemini-image-understanding** — analyzing images (OCR, captioning, bounding boxes)
- **gemini-document-processing** — PDFs and other documents
- **gemini-google-search** — grounding responses with Google Search + citations
- **gemini-deep-research** — multi-step autonomous research with sources

## Anti-Hallucination Rule for Gemini Skills

The Gemini API surface evolves quickly (preview models, renamed tools, new SDKs). Before claiming a specific model ID, parameter name, or method signature exists:

1. Check this skill's referenced docs.
2. If not covered, fetch the current page from `https://ai.google.dev/gemini-api/docs/...` with WebFetch or `npx ctx7 docs /google/genai "<question>"`.
3. If the source is unreachable, mark the claim `**UNVERIFIED:**` rather than inventing a plausible API.
