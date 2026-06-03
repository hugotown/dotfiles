# Image Generation — Full Parameter Reference

**Verified against `google-genai==1.66.0` Python SDK, Gemini API backend, 2026-05-22.**

The image-control parameter is `image_config: types.ImageConfig` (NOT `response_format` — that field does not exist on `types.GenerateContentConfig` in this SDK). All fields below are real fields on the `types.ImageConfig` class.

## `response_modalities` (required at `GenerateContentConfig` level)

| Value | Effect |
|-------|--------|
| `["IMAGE"]` | Image only. Skip the text part entirely. |
| `["TEXT", "IMAGE"]` | Image + commentary text. Useful when you want the model to describe what it created. |

## `image_config.aspect_ratio`

### `gemini-3.1-flash-image-preview` and `gemini-3-pro-image-preview`

`1:1`, `1:4`, `1:8`, `2:3`, `3:2`, `3:4`, `4:1`, `4:3`, `4:5`, `5:4`, `8:1`, `9:16`, `16:9`, `21:9`

### `gemini-2.5-flash-image`

`1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9`  (no `1:4`, `1:8`, `4:1`, `8:1`)

### Common picks by use case

| Use | Pick |
|-----|------|
| Square social post | `1:1` |
| Landscape header / wallpaper | `16:9` |
| Portrait story / reel | `9:16` |
| Cinematic banner | `21:9` |
| Print-ish portrait | `4:5` |
| Print-ish landscape | `5:4` |
| Ultra-wide skyscraper / banner ad | `8:1` (3.1 / 3 Pro only) |

## `image_config.image_size`

| Model | Allowed |
|-------|---------|
| `gemini-2.5-flash-image` | (fixed at 1024px — parameter ignored) |
| `gemini-3.1-flash-image-preview` | `512`, `1K`, `2K`, `4K` |
| `gemini-3-pro-image-preview` | `1K`, `2K`, `4K` |

## Other `ImageConfig` fields (verified against SDK 1.66.0)

| Field | Type | Notes |
|-------|------|-------|
| `aspect_ratio` | str | see table above |
| `image_size` | str | see table above |
| `person_generation` | str | controls whether people may appear (enum values vary by region; check live docs) |
| `prominent_people` | `ProminentPeople` | controls handling of well-known public figures |
| `output_mime_type` | str | **Defined on the SDK class but the Gemini backend rejects it** with `"output_mime_type parameter is not supported in Gemini API"`. Only honored when the SDK is pointed at Vertex AI. Output is JPEG on Gemini API. |
| `output_compression_quality` | int | JPEG compression quality. Vertex-only behavior likely; test on Gemini API before relying. |
| `image_output_options` | `types.ImageConfigImageOutputOptions` | advanced encoding options |

## `thinking_config` (3.1 Flash / 3 Pro only)

```python
thinking_config=types.ThinkingConfig(
    thinking_level="High",       # "minimal" | "High"
    include_thoughts=True,       # surface thought parts in response
)
```

Thinking tokens are **billed regardless** of `include_thoughts`. Set `include_thoughts=False` if you don't want to display them; you still pay.

## `tools` (optional)

| Tool | Purpose |
|------|---------|
| `{"google_search": {}}` | Ground the image on real-world current data ("draw today's weather", "current stock chart"). |

For details on the response shape when Search is enabled, see the **gemini-google-search** skill.

## Input images (for editing / composition)

| Method | Python | JavaScript |
|--------|--------|------------|
| File path → PIL | `Image.open("path.png")` | n/a (use buffer below) |
| Inline base64 | `types.Part.from_bytes(data=bytes_, mime_type="image/png")` | `{ inlineData: { mimeType: "image/png", data: base64String } }` |
| File API (large/reused) | `client.files.upload(file="path.png")` | `ai.files.upload({ file: ..., config: { mimeType: "image/png" } })` |

Max input images per request:
- `gemini-2.5-flash-image`: 3
- `gemini-3.1-flash-image-preview`: 14 (≤10 objects + ≤4 characters)
- `gemini-3-pro-image-preview`: 14 (≤6 objects + ≤5 characters)

## What IS available (frequently asked, often missed)

- **`seed: int`** lives on `GenerateContentConfig`, not on `ImageConfig`. Use for reproducibility:
  ```python
  config=types.GenerateContentConfig(
      response_modalities=["IMAGE"],
      seed=42,
      image_config=types.ImageConfig(aspect_ratio="1:1", image_size="1K"),
  )
  ```
- **Safety:** `safety_settings: list[SafetySetting]` on `GenerateContentConfig`.
- **Temperature / top-p / top-k:** available on `GenerateContentConfig` but effect on image output is typically subtle.

## Not exposed by the API

- Negative prompt (no `negative_prompt` field — express in the main prompt instead)
- `num_images` per call (single output per call)
- Custom style codes (style via prompt only)
