# Gemini SDK — Per-Language Hello-World

## Go

```bash
go get google.golang.org/genai
```

```go
package main

import (
    "context"
    "fmt"
    "google.golang.org/genai"
)

func main() {
    ctx := context.Background()
    client, err := genai.NewClient(ctx, nil) // reads GEMINI_API_KEY
    if err != nil { panic(err) }

    r, err := client.Models.GenerateContent(ctx,
        "gemini-2.5-flash",
        genai.Text("hello"),
        nil,
    )
    if err != nil { panic(err) }
    fmt.Println(r.Text())
}
```

Verified on 2026-05-22 with `go1.25.3 darwin/arm64` and the latest `google.golang.org/genai` from `go get`. Returns `"hello"` from `gemini-2.5-flash` and lists models via `client.Models.List(ctx, nil)`.

Signature notes confirmed by real run:
- `genai.NewClient(ctx, nil)` — second arg is `*ClientConfig`; pass `nil` for env-var defaults.
- `client.Models.GenerateContent(ctx, model, content, config)` — four args; last is `*GenerateContentConfig`, also `nil`-able.
- The model returns `genai.Text(...)` for `genai.Content` content; use `r.Text()` to flatten parts to a string.

Like Python and JavaScript, the Go SDK also emits `Warning: Both GOOGLE_API_KEY and GEMINI_API_KEY are set. Using GOOGLE_API_KEY.` when both env vars are defined.

## Java (Maven)

```xml
<dependency>
  <groupId>com.google.genai</groupId>
  <artifactId>google-genai</artifactId>
  <version>1.0.0</version>
</dependency>
```

**UNVERIFIED:** The fetched libraries page reported the entry-point class as `GenerativeAIClient`, which contradicts the Python/JS naming convention (`Client` / `GoogleGenAI`). The Java SDK README at <https://github.com/googleapis/java-genai> is the source of truth — confirm class name there before writing Java samples for the user.

## C# / .NET

```bash
dotnet add package Google.GenAI
```

**UNVERIFIED:** No code sample published on the libraries summary page. Fetch <https://googleapis.github.io/dotnet-genai/> for the current quick-start before producing C# code.

## Verifying the install (any language)

After install, list models — if you can list, your key + SDK are wired correctly:

```python
from google import genai
for m in genai.Client().models.list():
    print(m.name)
```

```javascript
import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({});
for await (const m of await ai.models.list()) console.log(m.name);
```
