---
name: gemini-image-generation
description: "Use when generating or editing images with Gemini ('nano banana', Gemini 2.5/3 Flash Image, Gemini 3 Pro Image, Imagen 4). Triggers — 'generate an image', 'create a picture', 'make a poster', 'edit this image', 'change the background', 'stylize', 'swap subjects', 'compose these photos', 'infographic', 'thumbnail', 'Facebook cover', 'Instagram post', 'wallpaper 4K'. Handles all parameters: aspect ratio (1:1, 16:9, 9:16, 21:9, 4:5, etc.), resolution (1K/2K/4K), multi-image reference (up to 14 inputs), multi-turn editing chat, Google Search grounding for current-events imagery, and thinking control."
---

# Gemini Image Generation — Nano Banana & Imagen

Source: <https://ai.google.dev/gemini-api/docs/image-generation>

**REQUIRED BACKGROUND:** `gemini-common` (API key, output folders, ask-vs-direct rule).

## Quick Reference

| File | Contents |
|------|----------|
| [parameters.md](parameters.md) | Every supported parameter with valid values per model (aspect ratio, resolution, thinking level, response modalities, reference image limits). |
| [examples.md](examples.md) | Working code for: text-to-image, single-image edit, multi-image composition, multi-turn chat, search-grounded image, thinking-controlled generation. Python and JavaScript. |

## Models at a glance

| Model | Resolutions | Aspect ratios | Max refs | When |
|-------|-------------|---------------|----------|------|
| `gemini-2.5-flash-image` | 1K only | 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9 | 3 | High-volume, low-latency, simple prompts |
| `gemini-3.1-flash-image-preview` | 512, 1K, 2K, 4K | 1:1, 1:4, 1:8, 2:3, 3:2, 3:4, 4:1, 4:3, 4:5, 5:4, 8:1, 9:16, 16:9, 21:9 | 14 (10 obj + 4 char) | Default for most tasks |
| `gemini-3-pro-image-preview` | 1K, 2K, 4K | same as 3.1 | 14 (6 obj + 5 char) | Professional asset production |
| `imagen-4` | (separate API surface) | — | — | When Imagen pipeline is specifically requested |

## The ask-vs-direct rule (applied to image generation)

| User said | Action |
|-----------|--------|
| "Generate a 4K landscape wallpaper" | Direct → `16:9`, `4K`. |
| "Make me a Facebook post image" | Suggest+ask: default `1:1` at `1K`. |
| "Cover image for my Facebook page" | Suggest+ask: default `16:9` at `2K`. |
| "Instagram story" | Suggest+ask: default `9:16` at `1K`. |
| "TikTok thumbnail" | Suggest+ask: default `9:16` at `1K`. |
| "X/Twitter header" | Suggest+ask: default `16:9` (3:1 not supported by 2.5 Flash; use 3.1 Flash for `8:1` if needed). |
| "Picture of a cat" | Ask: aspect ratio? resolution? Default offered: `1:1`, `1K`. |

When asking, use the question tool with the suggested default as the first option.

## Prompt detail level — when to go hyper-detailed

The model renders what you describe. Vague prompt → generic image. The decision of HOW MUCH detail to inject is CONDITIONAL — hyper-detail helps photorealism and hurts simple/flat styles.

### When hyper-detail is required

| Image type | Hyper-detail? | Why |
|---|---|---|
| Photorealistic portraits, people | **YES** | Skin pores, hair strands, microexpressions, eye catchlights define quality |
| Product photography | **YES** | Materials, reflections, edge sharpness, shadows sell the object |
| Architecture, interiors, landscapes | **YES** | Depth, texture, time-of-day, atmospheric perspective |
| Cinematic / editorial scenes | **YES** | Composition, mood, lens character, film grain |
| Food, still life, macro | **YES** | Texture, steam, condensation, freshness cues |
| Flat illustration, vector, flat design | **NO** | Excess detail breaks the style |
| Icons, logos, symbols | **NO** | Simplicity IS the goal |
| Infographics, diagrams, wireframes | **NO** | Structural clarity > photorealism |
| Memes, stickers, simple cartoons | **NO** | Hyper-detail looks forced |
| Early concept sketches | **NO** | Loose strokes are the point |

### The mental model

**Describe the image as if you were dictating it to someone who lost their sight two days ago — their visual memory is intact, but every element must be NAMED for them to reconstruct the scene photographically in their mind.**

"A man in a shirt" gives them nothing to rebuild. "A 40-year-old man with three-day stubble, wearing a wrinkled natural-linen shirt with rolled sleeves, lit from a low east-facing window at 7am, standing slightly off-center facing left, shallow depth of field from an 85mm lens, warm tungsten fill bouncing off a brick wall behind him" — that they can paint in their head.

### The 8 dimensions to specify when going hyper-detailed

1. **Subject**: apparent age, posture, expression, clothing with materials (wrinkled linen, not "shirt")
2. **Lighting**: direction, hardness, color temperature, simulated time of day
3. **Camera / lens**: apparent focal length (35mm, 85mm, macro), depth of field, angle, height
4. **Materials and textures**: skin pores, wood grain, glass condensation, fabric weave
5. **Color**: dominant palette + accents, warm/cool temperature, saturation level
6. **Composition**: rule of thirds, leading lines, what is in focus vs blurred
7. **Atmosphere**: dust motes, fog, smoke, airborne particles, humidity
8. **Edges and shadows**: sharpness, direction, length, hardness (hard noon vs soft overcast)

### Before / after — same subject, two prompts

**Weak:**
> A cup of coffee on a wooden table.

**Hyper-detailed:**
> A white ceramic cup of black coffee, steam curling upward in thin wisps, sitting on a weathered oak table with visible grain and one knot near the rim. Morning light from a window camera-left, soft and warm (around 6500K filtered through curtains), casting a long soft shadow to the right. Shallow depth of field, 50mm lens at f/2.0, focus on the rim of the cup, background dissolving into bokeh of a kitchen interior. A few coffee grounds dusted near the saucer. Slight steam haze in the air, fine film grain, editorial breakfast photography mood.

**Rule of thumb:** if the user wants something they could photograph in real life, go hyper-detailed. If the user wants something a designer would draw in Figma or Illustrator, stay clean and structural.

## Minimal call (Python)

```python
from google import genai
from google.genai import types
from datetime import datetime
from pathlib import Path

client = genai.Client()

response = client.models.generate_content(
    model="gemini-3.1-flash-image-preview",
    contents="A nano banana served on a porcelain plate in a fancy restaurant",
    config=types.GenerateContentConfig(
        response_modalities=["IMAGE"],
        image_config=types.ImageConfig(aspect_ratio="16:9", image_size="2K"),
    ),
)

out = Path("gemini-output/images")
out.mkdir(parents=True, exist_ok=True)
stamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
for part in response.parts:
    if image := part.as_image():
        path = out / f"nano-banana_{stamp}.png"
        image.save(path)
        print("saved:", path)
```

Output ALWAYS goes under `gemini-output/images/` with the slug-timestamp filename (per `gemini-common/output-conventions.md`).

## Minimal call (JavaScript)

```javascript
import { GoogleGenAI } from "@google/genai";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ai = new GoogleGenAI({});
const r = await ai.models.generateContent({
  model: "gemini-3.1-flash-image-preview",
  contents: "A nano banana served on a porcelain plate in a fancy restaurant",
  config: {
    responseModalities: ["IMAGE"],
    imageConfig: { aspectRatio: "16:9", imageSize: "2K" },
  },
});

mkdirSync("gemini-output/images", { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
for (const part of r.candidates[0].content.parts) {
  if (part.inlineData) {
    const file = join("gemini-output/images", `nano-banana_${stamp}.png`);
    writeFileSync(file, Buffer.from(part.inlineData.data, "base64"));
    console.log("saved:", file);
  }
}
```

## Known limits and gotchas

- **Watermark:** all generated images carry an invisible SynthID watermark. Don't promise the user a "clean" image.
- **No transparent background.** If transparency is requested, generate on a flat solid color and post-process with `rembg` / `u2net` (the `hyperframes-media` skill covers `remove-background`).
- **Output count:** the model often returns ONE image even when asked for multiple. Loop calls if you need a batch.
- **People-from-web** for `gemini-3.1-flash-image-preview` + Google Search grounding cannot use real-world photos of people retrieved from the web.
- **Seed IS available** — `types.GenerateContentConfig(seed=42, ...)`. Use it for reproducibility.
- **No negative prompt** exposed by the API. Style and content control is via the prompt only.
- **Output MIME is JPEG by default** on the Gemini API (not PNG). The `types.ImageConfig.output_mime_type` field is defined in the SDK class but **the Gemini backend rejects it** with `"output_mime_type parameter is not supported in Gemini API."` — it's only honored when the SDK is pointed at Vertex AI. If you need PNG, decode the JPEG bytes and re-encode with PIL.
- **Languages with strong support:** EN, ar-EG, de-DE, es-MX, fr-FR, hi-IN, id-ID, it-IT, ja-JP, ko-KR, pt-BR, ru-RU, ua-UA, vi-VN, zh-CN. Other languages may degrade quality.

## What lives in the supporting files

- **[parameters.md](parameters.md)** — every aspect ratio, every resolution, every config field, with the exact valid values per model. Read this BEFORE pinning a parameter for a user prompt.
- **[examples.md](examples.md)** — copy-paste recipes for editing, composition, multi-turn chat, and Google-Search-grounded image generation. Python + JS.
