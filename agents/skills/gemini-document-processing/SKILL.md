---
name: gemini-document-processing
description: Use when processing PDFs or other documents with Gemini. Triggers — "summarize this PDF", "extract data from this document", "compare these two papers", "read this contract", "what does this report say about X", "list all tables in this PDF", "convert PDF to structured JSON", "OCR this multi-page document". Handles native PDF vision (text + images + tables + charts in one pass), inline upload (small files), File API (large/reused, up to 50 MB and 1000 pages), and multi-document requests. NOT for one-off image OCR — that is gemini-image-understanding.
---

# Gemini Document Processing — PDFs and Beyond

Source: <https://ai.google.dev/gemini-api/docs/document-processing>

**REQUIRED BACKGROUND:** `gemini-common`.

## Quick Reference

| File | Contents |
|------|----------|
| [examples.md](examples.md) | Inline upload, File API upload (local + URL), multi-document compare, structured extraction. Python + JS. |

## Supported formats

| Format | MIME | Vision parsing | Notes |
|--------|------|----------------|-------|
| PDF | `application/pdf` | **Yes** (charts, tables, diagrams, layout) | The good path. |
| TXT | `text/plain` | text only | No layout. |
| Markdown | `text/markdown` | text only | No layout. |
| HTML | `text/html` | text only | No layout, no rendering. |
| XML | `application/xml` | text only | |

> "Non-PDF documents will be seen as normal text which will eliminate context (charts, diagrams, formatting)." If the user has a `.docx` and needs layout/tables preserved, **convert to PDF first** (LibreOffice CLI, `pandoc`, or print-to-PDF).

## Limits

| Item | Value |
|------|-------|
| Max file size | 50 MB |
| Max page count | 1000 pages |
| Token cost per page | 258 tokens |
| Max scaled image res per page | 3072 × 3072 px |
| File API storage | 48 hours |

In Gemini 3 models, **native text extracted from PDFs is not charged** as tokens (only the vision/image processing per page is).

## Two upload paths

| Path | When | Code |
|------|------|------|
| Inline bytes | File < ~10 MB, one-shot use | `types.Part.from_bytes(data=path.read_bytes(), mime_type="application/pdf")` |
| File API | File ≥ ~10 MB, reused across multiple requests, multi-turn chats | `client.files.upload(file="big.pdf")` |

**Don't inline a 40 MB PDF.** Bandwidth + latency cost is real; File API is free.

## Minimal summarization (Python)

```python
from google import genai
from google.genai import types
import pathlib

client = genai.Client()
pdf = pathlib.Path("report.pdf")

r = client.models.generate_content(
    model="gemini-2.5-flash",
    contents=[
        types.Part.from_bytes(data=pdf.read_bytes(), mime_type="application/pdf"),
        "Summarize this document in 5 bullets. Then list every table and what it contains.",
    ],
)

out = pathlib.Path("gemini-output/documents")
out.mkdir(parents=True, exist_ok=True)
(out / f"{pdf.stem}_summary.md").write_text(r.text)
```

## Minimal summarization (JavaScript)

```javascript
import { GoogleGenAI } from "@google/genai";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ai = new GoogleGenAI({});
const data = readFileSync("report.pdf").toString("base64");
const r = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: [
    { text: "Summarize this document in 5 bullets. Then list every table." },
    { inlineData: { mimeType: "application/pdf", data } },
  ],
});

mkdirSync("gemini-output/documents", { recursive: true });
writeFileSync(join("gemini-output/documents", "report_summary.md"), r.text);
```

## Structured extraction (JSON)

```python
config = types.GenerateContentConfig(response_mime_type="application/json")
r = client.models.generate_content(
    model="gemini-2.5-pro",   # pro for stricter schema obedience on hard PDFs
    contents=[
        types.Part.from_bytes(data=pdf.read_bytes(), mime_type="application/pdf"),
        "Extract every line item from invoices as JSON: "
        "[{ 'sku': str, 'description': str, 'qty': int, 'unit_price': float, 'total': float }]",
    ],
    config=config,
)
import json
items = json.loads(r.text)
```

For very strict shape control, combine with structured-output / `response_schema` (Pydantic). **UNVERIFIED:** exact `response_schema` parameter syntax — confirm via the structured-output page before relying on it.

## Known limits and gotchas

- **No page / region targeting.** You cannot say "process pages 12-15 only" via API parameter — instead split the PDF before uploading, or instruct in the prompt ("focus on pages 12-15").
- **Rotate before uploading.** No auto-rotation.
- **Single-page docs:** place the page first, then the text prompt (same rule as image-understanding).
- **`.docx` quality drops.** Convert to PDF for any layout-sensitive doc.
- **Token usage metadata** counts PDF pages under the `IMAGE` modality — not `TEXT`. Pricing math: `pages × 258 tokens` for vision, plus output text tokens.

## Output conventions

Save under `gemini-output/documents/`:
- Summaries → `.md`
- Extracted structured data → `.json`
- Q&A transcripts → `.txt`

## When NOT to use this skill

- Single image OCR → **gemini-image-understanding**
- Live web data inside a doc-driven prompt → combine with **gemini-google-search**
- Multi-step research synthesis across many sources → **gemini-deep-research**
