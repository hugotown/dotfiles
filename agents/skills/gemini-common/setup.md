# Gemini — API Key & SDK Setup

## Where to get the API key

1. Sign in at <https://aistudio.google.com/apikey>.
2. Click **Create API key** (free tier available; paid tier required for some preview models).
3. Copy the key (starts with `AIza...`).

## Where the key is expected to live

All official SDKs read **`GEMINI_API_KEY`** from the process environment. Set it once in your shell init (`~/.zshrc`, `~/.bashrc`, fish `env.fish`, etc.):

```bash
export GEMINI_API_KEY="AIza...your-key..."
```

**Verify:**
```bash
[ -n "$GEMINI_API_KEY" ] && echo "OK (${#GEMINI_API_KEY} chars)" || echo "MISSING"
```

If the variable is empty in a freshly opened shell, source the file (`source ~/.zshrc`) or restart the terminal session.

### Gotcha: `GOOGLE_API_KEY` takes precedence

The SDK also accepts `GOOGLE_API_KEY` and **uses it preferentially if both are set**:

```
UserWarning: Both GOOGLE_API_KEY and GEMINI_API_KEY are set. Using GOOGLE_API_KEY.
```

If you see this warning and the wrong key is being used, `unset GOOGLE_API_KEY` in your shell (or in the script before calling `genai.Client()`). Common cause: `gcloud` configures `GOOGLE_API_KEY` for unrelated APIs, conflicting with Gemini.

## Install the SDK

The current, supported family is **Google GenAI SDK** (the older `google-generativeai` Python package and `@google/generativeai` npm package are deprecated; migration deadline announced as 2025-11-30 on the official libraries page).

### Python

```bash
pip install google-genai
```

```python
from google import genai

client = genai.Client()  # reads GEMINI_API_KEY automatically
# or explicit:  client = genai.Client(api_key="AIza...")
```

### JavaScript / TypeScript (Node)

```bash
npm install @google/genai
```

```javascript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({});  // reads GEMINI_API_KEY automatically
// or explicit:  new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
```

### Go

```bash
go get google.golang.org/genai
```

```go
import "google.golang.org/genai"

ctx := context.Background()
client, _ := genai.NewClient(ctx, nil) // reads GEMINI_API_KEY automatically
```

### Java (Maven)

```xml
<dependency>
  <groupId>com.google.genai</groupId>
  <artifactId>google-genai</artifactId>
  <version>1.0.0</version>
</dependency>
```

**UNVERIFIED:** The exact Java entry-point class name (`GenerativeAIClient` vs `Client`) reported by the Gemini libraries page summary may be stale; confirm against `https://github.com/googleapis/java-genai` README before quoting it to the user.

## Migration from deprecated SDK

| Deprecated | Current | Notes |
|------------|---------|-------|
| `google-generativeai` (Python) | `google-genai` | Different import: `from google import genai` (not `import google.generativeai as genai`). Client-based API instead of `genai.GenerativeModel(...)`. |
| `@google/generativeai` (JS) | `@google/genai` | Class `GoogleGenAI` instead of `GoogleGenerativeAI`. |

## Sanity check (Python)

After install + env var:

```python
from google import genai
client = genai.Client()
r = client.models.generate_content(model="gemini-2.5-flash", contents="say hi in 3 words")
print(r.text)
```

If it prints text, setup is good. If it raises `PermissionDenied` or `401`, the key is wrong or unset. If it raises `NotFound` on the model, pick another from [models.md](models.md).
