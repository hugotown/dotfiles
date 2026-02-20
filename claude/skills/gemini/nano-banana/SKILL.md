---
name: nano-banana-image-generation
description: Generates and edits images using Gemini Nano Banana Python SDK. Handles text-to-image, image editing, multi-turn editing, 4K output, style transfer, inpainting, and Google Search grounding. Use when the user asks to generate, create, edit, modify, draw, design, or transform images.
user-invocable: false
---

# Nano Banana Image Generation

Generate and edit images via Gemini Python SDK (`google-genai`). Supports text-to-image, image editing, style transfer, inpainting, and multi-turn conversations.

**Prerequisite:** GEMINI_API_KEY must be validated by the parent `gemini` skill before proceeding. Include the client boilerplate from the parent skill at the top of every script.

## Step 1: Select Model

| Model | ID | Best For |
|-------|----|----------|
| **Nano Banana** | `gemini-2.5-flash-image` | Speed, high-volume, low-latency. Max 3 input images. 1K output. |
| **Nano Banana Pro** | `gemini-3-pro-image-preview` | Pro quality, complex instructions, text rendering, 4K, Google Search grounding. Up to 14 input images. Thinking enabled by default. |

**Default:** Use `gemini-3-pro-image-preview` (Nano Banana Pro) for ALL requests. Only switch to `gemini-2.5-flash-image` if the user explicitly requests speed or simplicity.

## Step 2: Determine Operation Type

| Operation | Input | Description |
|-----------|-------|-------------|
| **Text-to-Image** | Text only | Generate image from text prompt |
| **Image Editing** | Text + image(s) | Edit/modify existing image(s) |
| **Multi-turn** | Chat session | Iterative refinement via chat API |

## Step 3: Generate

### Text-to-Image

```python
from google.genai import types

response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=["YOUR PROMPT HERE"],
    config=types.GenerateContentConfig(
        response_modalities=['TEXT', 'IMAGE']
    )
)
```

### Image Editing (text + image)

```python
from PIL import Image

img = Image.open('input.png')
response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=["YOUR EDIT PROMPT", img],
    config=types.GenerateContentConfig(
        response_modalities=['TEXT', 'IMAGE']
    )
)
```

### With Aspect Ratio and Resolution (Pro model)

```python
response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=["YOUR PROMPT"],
    config=types.GenerateContentConfig(
        response_modalities=['TEXT', 'IMAGE'],
        image_config=types.ImageConfig(
            aspect_ratio="16:9",
            image_size="2K"
        )
    )
)
```

### With Google Search Grounding (Pro model)

```python
response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=["YOUR PROMPT"],
    config=types.GenerateContentConfig(
        response_modalities=['TEXT', 'IMAGE'],
        tools=[{"google_search": {}}],
        image_config=types.ImageConfig(aspect_ratio="16:9")
    )
)
```

### Multi-turn Editing (Chat API)

The chat API handles thought signatures automatically — no manual tracking needed.

```python
chat = client.chats.create(
    model="gemini-3-pro-image-preview",
    config=types.GenerateContentConfig(
        response_modalities=['TEXT', 'IMAGE']
    )
)

response1 = chat.send_message("Create an infographic about photosynthesis.")
# Save response1 image...

response2 = chat.send_message("Update to Spanish. Keep everything else the same.",
    config=types.GenerateContentConfig(
        image_config=types.ImageConfig(aspect_ratio="16:9", image_size="2K")
    )
)
```

## Step 4: Process and Save Response

**Default output directory:** `./gemini-skill/images/` (relative to the current project). Use a different path only if the user specifies one.

```python
import os
from datetime import datetime

os.makedirs('./gemini-skill/images', exist_ok=True)
ts = datetime.now().strftime('%Y%m%d-%H%M%S')

for part in response.parts:
    if part.text is not None:
        print(part.text)
    elif part.inline_data is not None:
        image = part.as_image()
        path = f'./gemini-skill/images/image-{ts}.png'
        image.save(path)
        print(f'Image saved: {path}')
```

**Always inform the user** of the saved file path after generation.
**Remind the user** to add `gemini-skill/` to `.gitignore` if not already present.

## Step 5: Ask User for Next Action

After generating, offer:
- Refine/iterate on the generated image (multi-turn editing)
- Change aspect ratio or resolution
- Apply a different style
- Generate a new image

## Configuration Reference

### Aspect Ratios
`1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9`

### Resolutions (Pro model only)
`1K` (default), `2K`, `4K` — Must use uppercase K.

### Response Modalities
- `['TEXT', 'IMAGE']` — Returns text and image (default, recommended)
- `['IMAGE']` — Returns image only, no text

## Prompting Best Practices

- **Describe the scene narratively**, don't just list keywords
- **Be hyper-specific** about style, lighting, camera angles, textures
- **Provide context and intent** (e.g., "for a high-end skincare brand")
- **Use photography terms** for photorealistic results (lens, aperture, bokeh)
- **Use semantic negatives** ("empty street" instead of "no cars")
- **Iterate conversationally** for refinement

For detailed prompting templates and strategies, read `prompting-guide.md` in this skill directory.
For complete Python examples for all scenarios, read `examples.md` in this skill directory.
For detailed model comparison, read `models.md` in this skill directory.

## Important Notes

- All generated images include a SynthID watermark
- Supported input formats: PIL Image objects, or inline_data with `image/png`, `image/jpeg`, `image/webp`, `image/gif`
- When generating text in images, generate the text content first, then ask for the image
- Multi-turn via chat API handles thought signatures automatically (no manual tracking)
- Nano Banana Pro uses "Thinking" by default (cannot be disabled). Thought images are not charged.
- Up to 14 reference images with Pro model (6 objects + 5 humans)
