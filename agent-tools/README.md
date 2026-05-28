# agent-tools

Shared logic packages for AI coding agents living under `~/.config/`.

The problem this solves: both [pi](../pi/) and [opencode](../opencode/) need to call the same external APIs (Gemini, etc.). Without a shared package, that logic gets duplicated — two copies that diverge silently. `agent-tools/` is the fix: one package holds the real logic, each agent gets a thin wrapper that speaks its own tool-registration dialect.

---

## Architecture

```
~/.config/
├── agent-tools/
│   └── genai-core/          ← shared logic, pure TypeScript, no agent SDK
│       └── src/
│           ├── client.ts
│           ├── models.ts
│           └── image-generation/core.ts  …
│
├── pi/agent/extensions/gemini/   ← pi facade (typebox schemas, pi.registerTool)
│   ├── package.json              ← "genai-core": "file:../../../../agent-tools/genai-core"
│   └── image-generation/tool.ts  ← calls generateImage() from genai-core
│
└── opencode/                     ← opencode facade (zod schemas, @opencode-ai/plugin)
    ├── package.json              ← "genai-core": "file:../agent-tools/genai-core"
    └── gemini/tools-image.ts     ← calls generateImage() from genai-core
```

### Rule: logic lives exactly once

The shared package owns everything that is not agent-specific:
- API calls, data transformation, file I/O, output conventions
- Types and interfaces used by both facades

Each facade owns only its agent-specific glue:
- Schema definition (TypeBox for pi, Zod for opencode)
- Tool registration call (`pi.registerTool` vs `tool()`)
- Return-shape adaptation (pi content array vs opencode string/object)
- OS side-effects that depend on agent context (opening files, sending notifications)

---

## How bun wires it

Each facade adds the shared package with the `file:` protocol:

```json
// pi/agent/extensions/gemini/package.json
{
  "dependencies": {
    "genai-core": "file:../../../../agent-tools/genai-core"
  }
}

// opencode/package.json
{
  "dependencies": {
    "genai-core": "file:../agent-tools/genai-core"
  }
}
```

After `bun install`, bun creates `node_modules/genai-core/` in each consumer. Every `.ts` file inside is a symlink pointing back to `agent-tools/genai-core/src/`. This means edits to the source are immediately visible to both consumers — no rebuild, no copy step.

```bash
# Verify the symlinks are in place
ls -la pi/agent/extensions/gemini/node_modules/genai-core/src/models.ts
# → lrwxrwxrwx ... -> /Users/you/.config/agent-tools/genai-core/src/models.ts
```

If you add a new file to `genai-core/src/`, run `bun install` in each consumer to create the new symlink. Existing files update automatically without reinstalling.

---

## Gemini example: `genai-core`

### What it contains

```
genai-core/src/
├── client.ts                 # resolveApiKey(), getClient() — one GoogleGenAI instance
├── models.ts                 # IMAGE_MODELS, TEXT_MODELS, RESEARCH_AGENTS, ASPECT_RATIOS, IMAGE_SIZES
├── config.ts                 # buildTextGenConfig() — shared thinking/json config builder
├── output.ts                 # outputPath(), saveText(), saveBytes() — artifact conventions
├── image-generation/
│   ├── core.ts               # generateImage(form, cwd) → GeneratedImageDetails
│   ├── types.ts              # ImageForm, GeneratedImageDetails
│   └── response.ts           # extensionFor(), diagnoseEmptyResponse()
├── image-understanding/
│   ├── core.ts               # analyzeImage(input, cwd) → AnalyzeResult
│   └── load.ts               # loadImagePart() — URL or local file → Part
├── document-processing/
│   └── core.ts               # processDocument(input, cwd) → DocResult
├── google-search/
│   ├── core.ts               # groundedSearch(query, model, cwd) → SearchResult
│   └── citations.ts          # addCitations(), listSources()
├── deep-research/
│   └── research.ts           # startResearch(input, agent), pollResearch(id, query, cwd)
├── libraries/
│   └── sdk.ts                # buildSdkReport() → string
└── common/
    └── status.ts             # buildStatus() → StatusReport
```

All exports are declared in `package.json` under `"exports"`. Consumers import by subpath:

```ts
import { generateImage } from "genai-core/image-generation/core";
import { TEXT_MODELS }   from "genai-core/models";
```

### How pi wraps it (TypeBox + pi.registerTool)

```ts
// pi/agent/extensions/gemini/image-generation/tool.ts
import { generateImage } from "genai-core/image-generation/core";
import { IMAGE_MODELS, ASPECT_RATIOS, IMAGE_SIZES } from "genai-core/models";
import { Type } from "typebox";

const ImageSchema = Type.Object({
  prompt: Type.String(),
  model:  Type.Optional(StringEnum(IMAGE_MODELS)),
  // ...
});

export function registerImageTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "gemini_generate_image",
    parameters: ImageSchema,
    async execute(_id, p, _signal, _onUpdate, ctx) {
      const details = await generateImage({ ...p }, ctx.cwd);
      openExternally(details.path);           // pi-specific side effect
      return { content: [{ type: "text", text: `Saved to ${details.path}` }] };
    },
  });
}
```

### How opencode wraps it (Zod + @opencode-ai/plugin)

```ts
// opencode/gemini/tools-image.ts
import { tool } from "@opencode-ai/plugin";
import { generateImage } from "genai-core/image-generation/core";
import { IMAGE_MODELS } from "genai-core/models";

export const imageGenerationTool = tool({
  description: "Generate an image with Gemini Imagen.",
  args: {
    prompt: tool.schema.string().describe("What to generate"),
    model:  tool.schema.string().optional(),
    // ...
  },
  async execute(args, ctx) {
    const details = await generateImage({ ...args }, ctx.directory);
    openFile(details.path);                   // opencode-specific side effect
    return { output: `Image saved to ${details.path}` };
  },
});
```

The core function `generateImage` is identical in both cases. Only the schema syntax and return shape differ.

---

## Adding a tool to an existing core package

1. Add the function to `agent-tools/genai-core/src/<feature>/core.ts`.
2. Export it in `genai-core/package.json` under `"exports"` if it's a new subpath.
3. Wrap it in each facade (`pi/.../tool.ts`, `opencode/gemini/tools-*.ts`).
4. No `bun install` needed for the existing symlinks — the new export is live immediately.

## Creating a new core package

1. `mkdir -p agent-tools/<new-package>/src`
2. Create `package.json` with `"type": "module"`, `"private": true`, and `"exports"`.
3. Create `tsconfig.json` pointing to `src/`.
4. Run `bun install` inside the new package to pull its dependencies.
5. Add `"<new-package>": "file:<relative path>"` to each consumer's `package.json`.
6. Run `bun install` in each consumer.
7. Import by subpath: `import { ... } from "<new-package>/<subpath>"`.

---

## Conventions

| Convention | Value |
|---|---|
| Package privacy | Always `"private": true` — never published to npm |
| Exports | Named subpaths only, no barrel `"."` export |
| Functions | Pure: take input + `cwd`, return result. No global state, no agent SDK imports |
| Output artifacts | Always under `<cwd>/gemini-output/<category>/` via `outputPath()` |
| File size cap | 70 functional lines per file (non-blank, non-comment) |
| Commits | Conventional commits inside each package's own git repo |
