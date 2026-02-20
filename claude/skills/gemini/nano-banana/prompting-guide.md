# Prompting Guide

## Core Principle

Describe the scene narratively. A descriptive paragraph always produces better results than a list of keywords.

## Templates by Category

### 1. Photorealistic Scenes

```
A photorealistic [shot type] of [subject], [action/expression], set in
[environment]. Illuminated by [lighting], creating a [mood] atmosphere.
Captured with [camera/lens], emphasizing [textures/details]. [Aspect ratio].
```

**Example:** "A photorealistic close-up portrait of an elderly Japanese ceramicist with deep wrinkles and a warm smile, inspecting a freshly glazed tea bowl. Rustic workshop. Soft golden hour light through a window. 85mm portrait lens, soft bokeh."

### 2. Icons, Stickers, Assets

```
A [style] sticker of a [subject], featuring [characteristics] and [color palette].
[Line style] and [shading]. Background must be [white/transparent].
```

**Example:** "A kawaii-style sticker of a happy red panda wearing a bamboo hat, munching a leaf. Bold clean outlines, cel-shading, vibrant colors. White background."

### 3. Text in Images (use Pro model)

```
Create a [image type] for [brand/concept] with the text "[exact text]" in a
[font style]. Design: [style], color scheme: [colors].
```

**Example:** "Create a minimalist logo for 'The Daily Grind' coffee shop. Clean, bold, sans-serif. Black and white. Circle shape. Coffee bean integrated cleverly."

### 4. Product Mockups

```
A high-resolution studio-lit product photograph of [product] on [surface].
[Lighting setup] to [purpose]. [Camera angle] to showcase [feature].
Ultra-realistic, sharp focus on [detail]. [Aspect ratio].
```

### 5. Minimalist / Negative Space

```
A minimalist composition with a single [subject] in the [position].
Background: vast empty [color] canvas, significant negative space.
Soft [lighting direction] lighting. [Aspect ratio].
```

### 6. Sequential Art / Comics (use Pro model)

```
Make a [N] panel comic in a [art style]. Put the character in a [scene type].
```

### 7. Search-Grounded (use Pro model + google_search tool)

```
Visualize [real-time data request] as a [visualization type].
[Style and layout instructions].
```

**Example:** "Visualize the current weather forecast for San Francisco as a clean modern chart. Add outfit suggestions for each day."

## Editing Prompts

### Add/Remove Elements

```
Using the provided image of [subject], [add/remove/modify] [element].
Ensure the change [integration description].
```

### Inpainting (Semantic Masking)

```
Using the provided image, change only the [specific element] to [new element].
Keep everything else exactly the same.
```

### Style Transfer

```
Transform the provided photograph of [subject] into [art style].
Preserve the original composition but render with [stylistic elements].
```

### Combine Multiple Images

```
Create a new image combining elements from the provided images. Take [element
from image 1] and place it with [element from image 2]. Final image: [scene].
```

### Detail Preservation

```
Using the provided images, place [element from image 2] onto [element from
image 1]. Ensure [element from image 1] features remain completely unchanged.
[Integration description].
```

### Sketch to Photo

```
Turn this rough [medium] sketch of [subject] into a [style] photo.
Keep [specific features] but add [new details/materials].
```

## Pro Tips

- **Iterate:** "That's great, but make the lighting warmer" works well
- **Step-by-step for complex scenes:** "First, create [background]. Then add [foreground]. Finally, place [focal point]."
- **Semantic negatives:** Say "empty street" not "no cars"
- **Camera control:** Use terms like `wide-angle`, `macro`, `low-angle`, `bird's eye`
- **For text in images:** Generate the text content first, then request the image with that text
- **Character consistency:** Include previously generated images in subsequent prompts for 360-degree views
