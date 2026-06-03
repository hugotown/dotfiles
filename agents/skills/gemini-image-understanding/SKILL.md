---
name: gemini-image-understanding
description: Use when analyzing, describing, or extracting information FROM images with Gemini vision. Triggers — "describe this image", "caption", "OCR this", "extract text from screenshot", "what's in this picture", "classify this", "detect objects", "find bounding boxes", "segment", "count items", "read this receipt/invoice", "annotate", "compare two images", "find allergens on this label". NOT for generating new images (see gemini-image-generation).
---

# Gemini Image Understanding — Vision Input

Source: <https://ai.google.dev/gemini-api/docs/image-understanding>

**REQUIRED BACKGROUND:** `gemini-common`.

## Quick Reference

| File | Contents |
|------|----------|
| [capabilities.md](capabilities.md) | Captioning, OCR, classification, object detection (bounding-box format), segmentation, multi-image diffing. |
| [examples.md](examples.md) | All 4 input methods (inline bytes, URL, File API, PIL) in Python + JS, plus annotated-image output recipe. |

## Models

All Gemini 2.5 and 3.x models accept image input. Default: `gemini-2.5-flash`. Switch to `gemini-2.5-pro` for hard OCR or fine spatial reasoning.

## Supported formats and limits

| Item | Value |
|------|-------|
| MIME types | `image/png`, `image/jpeg`, `image/webp`, `image/heic`, `image/heif` |
| Max images per request | 3,600 |
| Total inline request size | 20 MB (prompts + images combined) |
| Token cost per small image (both dims ≤ 384px) | 258 tokens |
| Token cost per larger image | 258 tokens per 768×768 tile |

## Input methods (pick one)

| Method | When |
|--------|------|
| Inline base64 from local file | One-shot use, small files. |
| Inline base64 from URL | Public web image, single use. |
| File API upload | Reused across multiple requests, or large image (>10 MB). Free, files stored 48 h. |
| PIL `Image.open(...)` (Python only) | Easiest in Python notebooks. |

Code for all 4 in [examples.md](examples.md).

## Minimal caption (Python)

```python
from google import genai
from google.genai import types

client = genai.Client()
with open("photo.jpg", "rb") as f:
    img_bytes = f.read()

r = client.models.generate_content(
    model="gemini-2.5-flash",
    contents=[
        types.Part.from_bytes(data=img_bytes, mime_type="image/jpeg"),
        "Caption this image in one sentence.",
    ],
)
print(r.text)
```

**Important:** when combining an image with a text prompt, **put the image first, then the text.**

## Capability summary

| Task | Output | Skill section |
|------|--------|---------------|
| Caption / describe | free text | `capabilities.md → Captioning` |
| Visual Q&A | free text | `capabilities.md → Visual QA` |
| OCR | free text (or JSON if requested) | `capabilities.md → OCR` |
| Classification | text / JSON | `capabilities.md → Classification` |
| Object detection | JSON list of `{box_2d, label}`, where `box_2d = [ymin, xmin, ymax, xmax]` normalized 0-1000 | `capabilities.md → Bounding Boxes` |
| Segmentation | JSON masks | `capabilities.md → Segmentation` |
| Multi-image compare | free text | `capabilities.md → Multi-image` |

### Bounding box convention (critical)

Gemini returns boxes as `[ymin, xmin, ymax, xmax]` with values normalized to the integer range `[0, 1000]` (NOT `[0, 1]`, NOT pixel coordinates). Verified empirically on 2026-05-22 against `gemini-2.5-pro` with a panoramic illustration — 12/12 detections valid.

**Model choice for detection is non-negotiable:** `gemini-2.5-flash` returns malformed boxes (5-8 values, negative coords) on vector illustrations and extreme aspect ratios. Use `gemini-2.5-pro` for any non-trivial scene. See [capabilities.md](capabilities.md#object-detection-with-bounding-boxes) for the comparison.

To convert to pixel coordinates for image `(W, H)`:

```python
y1 = int(box[0] / 1000 * H)
x1 = int(box[1] / 1000 * W)
y2 = int(box[2] / 1000 * H)
x2 = int(box[3] / 1000 * W)
```

Full detect + annotate recipe in [examples.md](examples.md).

## `media_resolution` (Gemini 3)

Lives on `GenerateContentConfig`. Verified enum values (`google-genai==1.66.0`):

- `MEDIA_RESOLUTION_UNSPECIFIED`
- `MEDIA_RESOLUTION_LOW`
- `MEDIA_RESOLUTION_MEDIUM`
- `MEDIA_RESOLUTION_HIGH`

```python
config = types.GenerateContentConfig(
    media_resolution=types.MediaResolution.MEDIA_RESOLUTION_HIGH,
)
```

Higher = better small-text and fine-detail recognition, more tokens, more latency.

## Output conventions

Save analysis output under `gemini-output/vision/`:
- Free-text answers → `.txt` or `.md`
- JSON detections → `.json`
- Annotated images (with drawn boxes) → `.png`

## When NOT to use this skill

- Generating new images → **gemini-image-generation**
- Reading multi-page PDFs → **gemini-document-processing** (PDFs are a separate code path with different limits)
- Live web research → **gemini-google-search** or **gemini-deep-research**
