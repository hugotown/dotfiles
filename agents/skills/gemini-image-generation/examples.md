# Image Generation — Recipes

Every recipe writes to `gemini-output/images/` per `gemini-common/output-conventions.md`. Use the `gemini_out` helper from that file.

## 1. Edit a single image (text + image input)

### Python
```python
from google import genai
from google.genai import types
from PIL import Image

client = genai.Client()
response = client.models.generate_content(
    model="gemini-3.1-flash-image-preview",
    contents=[
        "Replace the background with a moody neon Tokyo alley at night, keep the cat exactly as is.",
        Image.open("input/cat.png"),
    ],
    config=types.GenerateContentConfig(
        response_modalities=["IMAGE"],
        image_config=types.ImageConfig(aspect_ratio="3:2", image_size="2K"),
    ),
)
for part in response.parts:
    if image := part.as_image():
        image.save(gemini_out("images", "cat-tokyo-alley", "png"))
```

### JavaScript
```javascript
import { readFileSync, writeFileSync } from "node:fs";
const base = readFileSync("input/cat.png").toString("base64");
const r = await ai.models.generateContent({
  model: "gemini-3.1-flash-image-preview",
  contents: [
    { text: "Replace the background with a moody neon Tokyo alley at night, keep the cat exactly as is." },
    { inlineData: { mimeType: "image/png", data: base } },
  ],
  config: {
    responseModalities: ["IMAGE"],
    imageConfig: { aspectRatio: "3:2", imageSize: "2K" },
  },
});
for (const p of r.candidates[0].content.parts) {
  if (p.inlineData) writeFileSync(geminiOut("images", "cat-tokyo-alley", "png"),
                                  Buffer.from(p.inlineData.data, "base64"));
}
```

## 2. Multi-image composition (up to 14 refs)

```python
response = client.models.generate_content(
    model="gemini-3.1-flash-image-preview",
    contents=[
        "An office group photo of these five people making funny faces, soft natural light.",
        Image.open("input/p1.png"),
        Image.open("input/p2.png"),
        Image.open("input/p3.png"),
        Image.open("input/p4.png"),
        Image.open("input/p5.png"),
    ],
    config=types.GenerateContentConfig(
        response_modalities=["IMAGE"],
        image_config=types.ImageConfig(aspect_ratio="5:4", image_size="2K"),
    ),
)
```

Each input is a "character" or "object" reference. The model holds identity across the output.

## 3. Multi-turn chat (iterative edits, same context)

```python
chat = client.chats.create(
    model="gemini-3.1-flash-image-preview",
    config=types.GenerateContentConfig(response_modalities=["TEXT", "IMAGE"]),
)

r1 = chat.send_message("Create a flat-style infographic explaining photosynthesis. EN labels.")
for p in r1.parts:
    if image := p.as_image():
        image.save(gemini_out("images", "photosynthesis-v1", "png"))

r2 = chat.send_message(
    "Now translate every label to Spanish, keep the layout identical.",
    config=types.GenerateContentConfig(
        response_modalities=["TEXT", "IMAGE"],
        image_config=types.ImageConfig(aspect_ratio="16:9", image_size="2K"),
    ),
)
for p in r2.parts:
    if image := p.as_image():
        image.save(gemini_out("images", "photosynthesis-es", "png"))
```

The chat preserves "thought signatures" between turns so the second image matches the first's layout.

## 4. Generate with Google Search grounding (current-events imagery)

```python
response = client.models.generate_content(
    model="gemini-3.1-flash-image-preview",
    contents="An illustrated weather forecast for the next 5 days in Mexico City. Use today's actual data.",
    config=types.GenerateContentConfig(
        response_modalities=["TEXT", "IMAGE"],
        response_format={"image": {"aspect_ratio": "16:9", "image_size": "2K"}},
        tools=[{"google_search": {}}],
    ),
)
```

Real-world photos of people retrieved from web search are NOT used by this model. Illustrated content only.

## 5. Thinking control for complex prompts

```python
response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents="A futuristic city built inside a giant glass bottle on a stormy ocean, painted in art-nouveau style with gold leaf details. Cinematic.",
    config=types.GenerateContentConfig(
        response_modalities=["IMAGE"],
        image_config=types.ImageConfig(aspect_ratio="21:9", image_size="4K"),
        thinking_config=types.ThinkingConfig(thinking_level="High", include_thoughts=False),
    ),
)
```

`thinking_level="High"` improves complex composition obedience but raises token cost (thinking tokens are billed even when `include_thoughts=False`).

## 6. Encode local file to base64 (Python helper)

```python
import base64
from pathlib import Path
def b64(p): return base64.b64encode(Path(p).read_bytes()).decode()
```

## Common errors

| Error | Cause |
|-------|-------|
| `INVALID_ARGUMENT: image_config.image_size` | Picked `4K` on `gemini-2.5-flash-image` (fixed at 1K). |
| `ValidationError: response_format Extra inputs are not permitted` | Using the wrong field name. The correct field is `image_config: types.ImageConfig(...)`. |
| `ValueError: output_mime_type parameter is not supported in Gemini API.` | The field is defined on the SDK's `types.ImageConfig` class (shared with Vertex AI) but the Gemini backend rejects it. Remove it; output is JPEG. |
| `INVALID_ARGUMENT: aspect_ratio` | `8:1` / `4:1` on `gemini-2.5-flash-image` (3.1 Flash and 3 Pro only). |
| Returned text only, no image | Forgot `response_modalities=["IMAGE"]` or `["TEXT","IMAGE"]`. |
| `NotFound: model gemini-3.1-flash-image-preview` | Key doesn't have preview access — fall back to `gemini-2.5-flash-image`. |
