# Complete Python SDK Examples

All examples use `google-genai` SDK. Include the client boilerplate (API key loading + `genai.Client`) before running.

## Client Boilerplate

```python
import os, sys
from datetime import datetime

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
    sys.exit(1)

from google import genai
from google.genai import types

client = genai.Client(api_key=api_key)
```

## Save Helper

```python
def save_response(response, output_dir='./gemini-skill/images'):
    os.makedirs(output_dir, exist_ok=True)
    ts = datetime.now().strftime('%Y%m%d-%H%M%S')
    for part in response.parts:
        if part.text is not None:
            print(part.text)
        elif part.inline_data is not None:
            path = f'{output_dir}/image-{ts}.png'
            part.as_image().save(path)
            print(f'Image saved: {path}')
```

## Text-to-Image

### Basic (Nano Banana Flash)

```python
response = client.models.generate_content(
    model="gemini-2.5-flash-image",
    contents=["A kawaii-style sticker of a happy red panda with a bamboo hat. White background."],
)
save_response(response)
```

### With Aspect Ratio (Nano Banana Flash)

```python
response = client.models.generate_content(
    model="gemini-2.5-flash-image",
    contents=["A minimalist red maple leaf on off-white canvas. Soft lighting."],
    config=types.GenerateContentConfig(
        image_config=types.ImageConfig(aspect_ratio="16:9")
    )
)
save_response(response)
```

### High Resolution (Nano Banana Pro)

```python
response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=["Da Vinci style anatomical sketch of a Monarch butterfly on textured parchment."],
    config=types.GenerateContentConfig(
        response_modalities=['TEXT', 'IMAGE'],
        image_config=types.ImageConfig(aspect_ratio="1:1", image_size="4K")
    )
)
save_response(response)
```

### Image Only (no text response)

```python
response = client.models.generate_content(
    model="gemini-2.5-flash-image",
    contents=["YOUR PROMPT"],
    config=types.GenerateContentConfig(
        response_modalities=['IMAGE']
    )
)
save_response(response)
```

## Image Editing

### Edit with Input Image

```python
from PIL import Image

img = Image.open('input.png')
response = client.models.generate_content(
    model="gemini-2.5-flash-image",
    contents=["Add a small wizard hat on the cat's head. Match the lighting.", img],
)
save_response(response)
```

### Inpainting (change specific element)

```python
from PIL import Image

img = Image.open('living_room.png')
response = client.models.generate_content(
    model="gemini-2.5-flash-image",
    contents=[img, "Change only the blue sofa to a brown leather chesterfield. Keep everything else unchanged."],
)
save_response(response)
```

### Style Transfer

```python
from PIL import Image

img = Image.open('city.png')
response = client.models.generate_content(
    model="gemini-2.5-flash-image",
    contents=[img, "Transform into Van Gogh Starry Night style. Swirling brushstrokes, deep blues and bright yellows."],
)
save_response(response)
```

### Combine Multiple Images

```python
from PIL import Image

dress = Image.open('dress.png')
model_img = Image.open('model.png')
response = client.models.generate_content(
    model="gemini-2.5-flash-image",
    contents=[dress, model_img, "Create a fashion photo. The woman from image 2 wearing the dress from image 1. Full-body shot, outdoor lighting."],
)
save_response(response)
```

## Google Search Grounding (Pro only)

```python
response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=["Visualize the current 5-day weather forecast for San Francisco as a modern chart with outfit suggestions."],
    config=types.GenerateContentConfig(
        response_modalities=['TEXT', 'IMAGE'],
        tools=[{"google_search": {}}],
        image_config=types.ImageConfig(aspect_ratio="16:9")
    )
)
save_response(response)
```

## Multi-turn Editing (Chat API)

Chat API handles thought signatures automatically — no manual tracking needed.

```python
# Create chat session
chat = client.chats.create(
    model="gemini-3-pro-image-preview",
    config=types.GenerateContentConfig(
        response_modalities=['TEXT', 'IMAGE'],
        tools=[{"google_search": {}}]
    )
)

# Turn 1: Generate
response1 = chat.send_message(
    "Create a vibrant infographic about photosynthesis as a plant recipe. Colorful kids' cookbook style."
)
save_response(response1)

# Turn 2: Edit (aspect ratio + resolution change)
response2 = chat.send_message(
    "Update this infographic to be in Spanish. Do not change any other elements.",
    config=types.GenerateContentConfig(
        image_config=types.ImageConfig(aspect_ratio="16:9", image_size="2K")
    )
)
save_response(response2)

# Turn 3: Further refinement
response3 = chat.send_message("Make the colors more vibrant and add a watercolor texture.")
save_response(response3)
```

## Multiple Reference Images (Pro, up to 14)

```python
from PIL import Image

persons = [Image.open(f'person{i}.png') for i in range(1, 6)]
response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=[
        "An office group photo of these people making funny faces.",
        *persons
    ],
    config=types.GenerateContentConfig(
        response_modalities=['TEXT', 'IMAGE'],
        image_config=types.ImageConfig(aspect_ratio="5:4", image_size="2K")
    )
)
save_response(response)
```

## Sketch to Photo (Pro)

```python
from PIL import Image

sketch = Image.open('car_sketch.png')
response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=[sketch, "Turn this rough pencil sketch into a polished photo of the finished concept car in a showroom. Metallic blue paint, neon rim lighting."],
)
save_response(response)
```

## Inspect Thinking Process (Pro)

```python
for part in response.parts:
    if part.thought:
        if part.text:
            print(f"Thought: {part.text}")
        elif part.inline_data is not None:
            part.as_image().save("thought_image.png")
```
