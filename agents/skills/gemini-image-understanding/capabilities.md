# Image Understanding — Capabilities

## Captioning

```python
r = client.models.generate_content(
    model="gemini-2.5-flash",
    contents=[image, "Write a one-sentence caption suitable for a photo gallery."],
)
```

## Visual QA

```python
r = client.models.generate_content(
    model="gemini-2.5-flash",
    contents=[image, "What color is the car parked on the left?"],
)
```

## OCR (text extraction)

Free-text:
```python
r = client.models.generate_content(
    model="gemini-2.5-flash",
    contents=[image, "Transcribe ALL visible text verbatim, preserving line breaks."],
)
```

Structured JSON:
```python
config = types.GenerateContentConfig(response_mime_type="application/json")
r = client.models.generate_content(
    model="gemini-2.5-pro",   # pro for harder OCR
    contents=[image, "Return JSON: { 'fields': [ {'label': str, 'value': str} ] }"],
    config=config,
)
import json
data = json.loads(r.text)
```

For invoices and receipts, prefer `gemini-2.5-pro`.

## Classification

```python
r = client.models.generate_content(
    model="gemini-2.5-flash",
    contents=[image, "Classify into exactly one of: 'cat', 'dog', 'other'. Return only the label."],
)
```

## Object detection with bounding boxes

Boxes returned as `[ymin, xmin, ymax, xmax]` normalized to integer range `0-1000` (verified on 2026-05-22 against `gemini-2.5-pro` with a panoramic illustration).

### Model selection matters here

| Model | Behavior on detection |
|-------|------------------------|
| `gemini-2.5-flash` | Cheap, fine on plain photographs. **Fails on vector illustrations, extreme aspect ratios (e.g. 2.39:1 panorama), or scenes with many small objects** — observed returning `box_2d` arrays with 5-8 values (extra rotation / segmentation fields), negative coordinates, and malformed JSON. Wastes tokens "thinking" with no clean output. |
| `gemini-2.5-pro` | Reliable for the same tasks. Higher cost (~3-4×) but produces strict `[ymin, xmin, ymax, xmax]` arrays consistently. Use this for detection in production. |

**Rule of thumb:** if detection on an image returns malformed `box_2d` or zero valid results with Flash, retry with Pro before debugging your prompt.

### The prompt format that survived real-world runs

Be explicit and constraint-heavy. The model will follow only what you spell out:

```text
Task: object detection on this image.
Return a JSON array. Each element MUST have exactly two keys:
  "label" (string, lowercase, singular English noun)
  "box_2d" (an array of EXACTLY 4 integers — no more, no less)
box_2d format: [ymin, xmin, ymax, xmax]
All four values normalized to the integer range 0..1000 (NOT pixel coordinates, NOT 0..1).
Constraints:
  - All values must be in [0, 1000]. NO negatives.
  - ymin < ymax and xmin < xmax.
  - Detect the prominent shapes only (≤20 objects).
  - Do NOT include rotation angles, polygons, or any extra fields.
Return JSON only, no prose.
```

### Working detect + validate + annotate recipe

```python
import json
from PIL import Image, ImageDraw, ImageFont
from google import genai
from google.genai import types

client = genai.Client()

# CRITICAL: convert to RGB. Many PNGs (especially flat vector exports) come in
# palette mode ('P', ≤256 colors). PIL.ImageDraw refuses to add hex outline
# colors once the 256-entry palette is full and raises:
#   ValueError: cannot allocate more than 256 colors
image = Image.open("scene.png").convert("RGB")
W, H = image.size

DET_PROMPT = """Task: object detection on this image.
Return a JSON array. Each element MUST have exactly two keys:
  "label" (string, lowercase, singular English noun)
  "box_2d" (array of EXACTLY 4 integers — no more, no less)
box_2d format: [ymin, xmin, ymax, xmax] normalized to integer 0..1000.
NO negatives. ymin<ymax and xmin<xmax. ≤20 objects. JSON only."""

r = client.models.generate_content(
    model="gemini-2.5-pro",   # ← Pro, not Flash, for non-trivial scenes
    contents=[image, DET_PROMPT],
    config=types.GenerateContentConfig(response_mime_type="application/json"),
)

detections = json.loads(r.text)

# Validate before drawing — never trust model output blindly
valid = []
for d in detections:
    box = d.get("box_2d")
    if not isinstance(box, list) or len(box) != 4: continue
    if not all(isinstance(v, (int, float)) and 0 <= v <= 1000 for v in box): continue
    y1, x1, y2, x2 = box
    if y1 >= y2 or x1 >= x2: continue
    valid.append(d)

draw = ImageDraw.Draw(image)
font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 28)
colors = ["#ff3366","#33ff66","#3366ff","#ffcc00","#ff66ff","#00ffcc","#ff9933"]

for i, d in enumerate(valid):
    y1, x1, y2, x2 = d["box_2d"]
    y1, y2 = int(y1 / 1000 * H), int(y2 / 1000 * H)
    x1, x2 = int(x1 / 1000 * W), int(x2 / 1000 * W)
    c = colors[i % len(colors)]
    draw.rectangle([x1, y1, x2, y2], outline=c, width=4)
    tb = draw.textbbox((x1 + 6, y1 + 6), d["label"], font=font)
    draw.rectangle([tb[0]-4, tb[1]-4, tb[2]+4, tb[3]+4], fill=c)
    draw.text((x1 + 6, y1 + 6), d["label"], fill="white", font=font)

image.save("gemini-output/vision/scene_annotated.png")
```

### Custom detection prompts

The model accepts arbitrary label sets:

```text
Detect every object that could contain a common allergen (gluten, dairy, peanut, tree nut, soy, egg, shellfish, fish).
Return JSON: [{ 'item': str, 'allergen': str, 'box_2d': [ymin, xmin, ymax, xmax] }]
```

## Segmentation

Gemini can return segmentation masks. **UNVERIFIED:** exact JSON schema for the masks (RLE? polygon? base64 PNG?). The image-understanding docs page references segmentation but the fetched summary did not include the schema. Fetch the live page or the Cookbook notebook (<https://github.com/google-gemini/cookbook>) for the current format before relying on it.

## Multi-image comparison / diff

```python
file1 = client.files.upload(file="before.jpg")

with open("after.png", "rb") as f:
    bytes2 = f.read()

r = client.models.generate_content(
    model="gemini-2.5-flash",
    contents=[
        "What changed between these two images? Be specific and list each difference.",
        file1,
        types.Part.from_bytes(data=bytes2, mime_type="image/png"),
    ],
)
print(r.text)
```

## Best practices

- Rotate the image to correct orientation BEFORE sending (the model does not auto-rotate).
- Place the image part BEFORE the text prompt when there's only one image.
- For images you'll reuse across many calls (e.g. a product catalog), upload via File API once instead of paying inline-bytes cost per call.
- Avoid blurry/low-contrast inputs for OCR.
