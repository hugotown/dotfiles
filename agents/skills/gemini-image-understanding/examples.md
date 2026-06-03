# Image Understanding — Input Recipes

## 1. Inline bytes from local file (Python)

```python
from google import genai
from google.genai import types

client = genai.Client()
with open("photo.jpg", "rb") as f:
    img = f.read()

r = client.models.generate_content(
    model="gemini-2.5-flash",
    contents=[
        types.Part.from_bytes(data=img, mime_type="image/jpeg"),
        "Caption this image.",
    ],
)
print(r.text)
```

## 2. Inline bytes from local file (JavaScript)

```javascript
import { GoogleGenAI } from "@google/genai";
import { readFileSync } from "node:fs";

const ai = new GoogleGenAI({});
const data = readFileSync("photo.jpg", { encoding: "base64" });

const r = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: [
    { inlineData: { mimeType: "image/jpeg", data } },
    { text: "Caption this image." },
  ],
});
console.log(r.text);
```

## 3. From URL (Python)

```python
import requests
url = "https://example.com/photo.jpg"
img_bytes = requests.get(url).content

r = client.models.generate_content(
    model="gemini-2.5-flash",
    contents=[
        types.Part.from_bytes(data=img_bytes, mime_type="image/jpeg"),
        "What is shown here?",
    ],
)
```

## 4. File API upload (Python — for reuse or large files)

```python
my_file = client.files.upload(file="photo.jpg")

# Reuse across many calls:
for prompt in ["Caption it.", "List visible colors.", "Detect faces (yes/no)."]:
    r = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[my_file, prompt],
    )
    print(prompt, "→", r.text)
```

## 5. File API upload (JavaScript)

```javascript
import { GoogleGenAI, createUserContent, createPartFromUri } from "@google/genai";

const ai = new GoogleGenAI({});
const file = await ai.files.upload({
  file: "photo.jpg",
  config: { mimeType: "image/jpeg" },
});

const r = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: createUserContent([
    createPartFromUri(file.uri, file.mimeType),
    "Caption this image.",
  ]),
});
console.log(r.text);
```

## 6. PIL Image (Python convenience)

```python
from PIL import Image
image = Image.open("photo.png")

r = client.models.generate_content(
    model="gemini-2.5-flash",
    contents=[image, "Describe this in two sentences."],
)
```

## 7. Full annotated-image pipeline

See `capabilities.md → Object detection with bounding boxes` for a complete detect-and-draw recipe that converts the `[ymin, xmin, ymax, xmax]` 0-1000 boxes to pixel coordinates and outputs an annotated PNG under `gemini-output/vision/`.
