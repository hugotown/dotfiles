---
name: gemini-libraries
description: Use when installing, upgrading, or migrating the official Gemini API SDK (Google GenAI SDK) in any language — Python `google-genai`, JavaScript/TypeScript `@google/genai`, Go `google.golang.org/genai`, Java `com.google.genai`, C# `Google.GenAI`. Also use when migrating off the deprecated `google-generativeai` / `@google/generativeai` packages (sunset 2025-11-30).
---

# Gemini Libraries — Official SDK Install & Migration

Source: <https://ai.google.dev/gemini-api/docs/libraries>

**REQUIRED BACKGROUND:** Read `gemini-common` first for `GEMINI_API_KEY` setup and the ask-vs-direct rule.

## Quick Reference

| Language | Package | Install | Entry point | Verified |
|----------|---------|---------|-------------|----------|
| Python | `google-genai` | `pip install google-genai` | `genai.Client()` | ✓ 2026-05-22 (1.66.0) |
| JS / TS | `@google/genai` | `npm install @google/genai` | `new GoogleGenAI({})` | ✓ 2026-05-22 (node 24) |
| Go | `google.golang.org/genai` | `go get google.golang.org/genai` | `genai.NewClient(ctx, nil)` | ✓ 2026-05-22 (go 1.25.3) |
| Java (Maven) | `com.google.genai:google-genai` | see [examples.md](examples.md) | see [examples.md](examples.md) | UNVERIFIED — no JVM available locally |
| C# / .NET | `Google.GenAI` | `dotnet add package Google.GenAI` | see [examples.md](examples.md) | UNVERIFIED — no dotnet locally |

In all three verified SDKs (Python, JS, Go), if both `GEMINI_API_KEY` and `GOOGLE_API_KEY` are set in the environment, the SDK uses `GOOGLE_API_KEY` and emits a warning. See `gemini-common/setup.md` for the unset/precedence workaround.

## Minimal hello-world

### Python
```python
from google import genai
client = genai.Client()  # reads GEMINI_API_KEY
print(client.models.generate_content(model="gemini-2.5-flash", contents="hello").text)
```

### JavaScript (Node)
```javascript
import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({});
const r = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: "hello" });
console.log(r.text);
```

For Go, Java, C# snippets see [examples.md](examples.md).

## Migration from deprecated SDKs

The legacy `google-generativeai` (Python) and `@google/generativeai` (JS) packages are sunset on **2025-11-30**. Migrate to:

| Deprecated | Current |
|------------|---------|
| `pip install google-generativeai` → `import google.generativeai as genai` | `pip install google-genai` → `from google import genai` |
| `npm install @google/generativeai` → `GoogleGenerativeAI` | `npm install @google/genai` → `GoogleGenAI` |
| `go.../generative-ai` | `google.golang.org/genai` |

### Python migration cheat-sheet

```python
# OLD (deprecated)
import google.generativeai as genai
genai.configure(api_key="...")
model = genai.GenerativeModel("gemini-1.5-flash")
r = model.generate_content("hello")

# NEW
from google import genai
client = genai.Client(api_key="...")  # or env var
r = client.models.generate_content(model="gemini-2.5-flash", contents="hello")
```

Key differences: client-based (not module-level `configure`), `client.models.generate_content` instead of `model.generate_content`, model passed per-call instead of bound to a `GenerativeModel`.

## Common mistakes

- **Installing both packages at once.** They live in different namespaces but you'll grep for the wrong API. Pick one and uninstall the other.
- **`from google import genai` without `pip install google-genai`** — the import name shadows the old `google.generativeai`. Confirm the installed package with `pip show google-genai`.
- **Reading the wrong docs** — the old `ai.google.dev/...generative-ai-python/...` URLs still resolve but describe the deprecated SDK. Current docs live at `ai.google.dev/gemini-api/docs/...`.

## Sunset/migration deadlines

Confirm against the live page before quoting dates to the user (Google has moved deadlines before):
- WebFetch <https://ai.google.dev/gemini-api/docs/libraries> and look for "deprecated" / "sunset" / "End of Life".

## Where to go next

- For per-call examples per capability: the matching `gemini-*` skill (image-generation, document-processing, etc.).
- For language-specific quick-start beyond Python/JS: [examples.md](examples.md).
