# Gemini — Output File Conventions

Every Gemini skill that produces artifacts MUST write them under `gemini-output/<category>/` in the user's current working directory.

## Folder map

```
gemini-output/
├── images/      # gemini-image-generation
├── vision/      # gemini-image-understanding (annotated images, JSON detections)
├── documents/   # gemini-document-processing (summaries, extracted JSON)
├── grounded/    # gemini-google-search (answers + citations)
├── research/    # gemini-deep-research (reports, sources, thoughts)
└── audio/       # reserved
```

## Filename convention

`<short-slug>_<YYYY-MM-DD>_<HHMMSS>.<ext>`

- `short-slug`: 2-5 lowercase words from the user prompt, joined with `-`
- Timestamp: local time, zero-padded
- Extension: matches the artifact (`.png`, `.json`, `.md`, `.txt`, `.pdf`)

Examples:
- `gemini-output/images/sunset-over-tokyo_2026-05-21_143022.png`
- `gemini-output/research/quantum-startups-2025_2026-05-21_091500.md`
- `gemini-output/vision/grocery-receipt-ocr_2026-05-21_120030.json`

## Python helper

Drop this at the top of any script:

```python
from datetime import datetime
from pathlib import Path
import re

def gemini_out(category: str, slug: str, ext: str, base: str = "gemini-output") -> Path:
    """Return a fresh output path under gemini-output/<category>/ with timestamped filename."""
    slug = re.sub(r"[^a-z0-9]+", "-", slug.lower()).strip("-")[:60] or "out"
    folder = Path(base) / category
    folder.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    return folder / f"{slug}_{stamp}.{ext}"

# Usage:
# path = gemini_out("images", "sunset over tokyo", "png")
# image.save(path)
```

## JavaScript helper

```javascript
import { mkdirSync } from "node:fs";
import { join } from "node:path";

export function geminiOut(category, slug, ext, base = "gemini-output") {
  const safeSlug =
    slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "out";
  const folder = join(base, category);
  mkdirSync(folder, { recursive: true });
  const d = new Date();
  const stamp =
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` +
    `_${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}`;
  return join(folder, `${safeSlug}_${stamp}.${ext}`);
}
```

## Why this convention

- Tells the user exactly where to find outputs without grepping.
- One folder is `.gitignore`-able as a unit (`gemini-output/`).
- Timestamped filenames mean re-running never silently overwrites the previous result.
