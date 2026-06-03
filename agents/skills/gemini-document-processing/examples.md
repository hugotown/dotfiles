# Document Processing — Recipes

## 1. Upload via File API — local file (Python)

```python
from google import genai
import pathlib

client = genai.Client()
pdf = client.files.upload(file=pathlib.Path("large.pdf"))

r = client.models.generate_content(
    model="gemini-2.5-flash",
    contents=[pdf, "Summarize section 4 in detail."],
)
print(r.text)
```

The uploaded file is reusable for 48 hours under `pdf.name`. Retrieve again:

```python
pdf_info = client.files.get(name=pdf.name)
print(pdf_info.state)  # ACTIVE / PROCESSING / FAILED
```

## 2. Upload via File API — remote URL (Python)

```python
import io, httpx

url = "https://www.nasa.gov/wp-content/uploads/static/history/alsj/a17/A17_FlightPlan.pdf"
buf = io.BytesIO(httpx.get(url).content)

pdf = client.files.upload(file=buf, config=dict(mime_type="application/pdf"))

r = client.models.generate_content(
    model="gemini-2.5-flash",
    contents=[pdf, "Summarize the flight plan in 6 bullets."],
)
print(r.text)
```

## 3. Upload via File API — wait for processing (JavaScript)

```javascript
import { GoogleGenAI, createPartFromUri } from "@google/genai";

const ai = new GoogleGenAI({});
const buf = await fetch("https://example.com/doc.pdf").then(r => r.arrayBuffer());
const blob = new Blob([buf], { type: "application/pdf" });

const file = await ai.files.upload({
  file: blob,
  config: { displayName: "doc.pdf" },
});

// Wait until ACTIVE before sending the request
let info = await ai.files.get({ name: file.name });
while (info.state === "PROCESSING") {
  await new Promise(r => setTimeout(r, 5000));
  info = await ai.files.get({ name: file.name });
}

const r = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: ["Summarize this document.", createPartFromUri(file.uri, file.mimeType)],
});
console.log(r.text);
```

The `PROCESSING → ACTIVE` wait is **mandatory for JS**; calling `generateContent` while the file is still processing returns an error.

## 4. Multi-document compare (Python)

```python
import io, httpx
client = genai.Client()

def upload_remote(url, mime="application/pdf"):
    return client.files.upload(file=io.BytesIO(httpx.get(url).content),
                               config=dict(mime_type=mime))

p1 = upload_remote("https://arxiv.org/pdf/2312.11805")
p2 = upload_remote("https://arxiv.org/pdf/2403.05530")

r = client.models.generate_content(
    model="gemini-2.5-pro",
    contents=[
        p1, p2,
        "Compare the benchmarks reported in both papers. Output a Markdown table with rows = benchmark, columns = each paper.",
    ],
)
out = pathlib.Path("gemini-output/documents/benchmark_compare.md")
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(r.text)
```

Total combined pages must stay under 1000.

## 5. Structured extraction with explicit JSON schema

```python
from google.genai import types

config = types.GenerateContentConfig(response_mime_type="application/json")
r = client.models.generate_content(
    model="gemini-2.5-pro",
    contents=[
        pdf,
        "Return JSON array. Each element: {'invoice_number': str, 'date': 'YYYY-MM-DD', "
        "'vendor': str, 'total': float, 'currency': str, "
        "'line_items': [{'description': str, 'qty': int, 'unit_price': float}]}",
    ],
    config=config,
)
import json
invoices = json.loads(r.text)
```

For Pydantic-typed responses use `response_schema=YourModel` (see structured-output docs).

## 6. Targeted page focus (no page-range parameter)

Since the API cannot select pages, either pre-split with `pypdf` / `pdftk`:

```python
from pypdf import PdfReader, PdfWriter
reader = PdfReader("big.pdf")
writer = PdfWriter()
for i in range(11, 15):  # pages 12-15 (0-indexed)
    writer.add_page(reader.pages[i])
with open("slice.pdf", "wb") as f:
    writer.write(f)
```

…or just instruct in the prompt ("Focus only on pages 12-15; ignore the rest"). Pre-splitting is cheaper because you pay for fewer image tiles.
