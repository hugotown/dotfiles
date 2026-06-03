# Deep Research — Streaming + Reconnect + Disk Persistence

**Verified against `google-genai==1.66.0` on 2026-05-22 by running a real Deep Research task.**

## Event and delta shapes observed at runtime

The fetched docs page named events `interaction.created` and `interaction.completed` with delta type `thought`. The actual SDK emits **different names** — using the doc-page names silently fails (no error, but `interaction_id` is never captured and thought summaries are dropped):

| Doc page said | Actual event in `google-genai 1.66.0` |
|---------------|----------------------------------------|
| `interaction.created` | `interaction.start` (carries the full `Interaction` object) |
| `interaction.completed` | `interaction.complete` |
| `event.event_type` only | also use `event.type` — both fields exist on some event classes |
| delta type `thought` | delta type `thought_summary`, text lives at `delta.content.text` (NOT `delta.text`) |
| — | delta type `text_annotation` — has `delta.annotations` (citations), `delta.text is None` |
| — | `interaction.status_update`, `content.start`, `content.stop` — emitted between deltas; safe to ignore for basic capture |

## Full Python recipe — stream, reconnect, save everything

```python
#!/usr/bin/env python3
"""Run a Deep Research task and stream + save everything to gemini-output/research/."""

from google import genai
from datetime import datetime
from pathlib import Path
import base64, json, re, time

def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:60] or "research"

def run_deep_research(query: str, max_agent: bool = False):
    client = genai.Client()
    agent_id = "deep-research-max-preview-04-2026" if max_agent else "deep-research-preview-04-2026"

    stamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    slug = slugify(query)
    base = Path("gemini-output/research")
    base.mkdir(parents=True, exist_ok=True)
    img_dir = base / f"{slug}_{stamp}.images"

    print(f"[{stamp}] starting {agent_id}\n  query: {query}\n")

    text_chunks: list[str] = []
    thoughts:    list[str] = []
    images_b64:  list[str] = []
    last_event_id = None
    is_complete = False
    interaction_id = None

    def consume(stream):
        nonlocal last_event_id, is_complete, interaction_id
        for ev in stream:
            ev_type = getattr(ev, "event_type", None) or getattr(ev, "type", None)
            if ev_type == "interaction.start":
                interaction_id = ev.interaction.id  # only event that carries the id
            if getattr(ev, "event_id", None):
                last_event_id = ev.event_id

            delta = getattr(ev, "delta", None)
            if delta is not None:
                t = delta.type
                if t == "text":
                    text_chunks.append(delta.text)
                    print(delta.text, end="", flush=True)
                elif t == "thought_summary":
                    # text lives at delta.content.text for thought summaries
                    txt = getattr(delta.content, "text", "") or ""
                    thoughts.append(txt)
                    print(f"\n[thought] {txt}\n", flush=True)
                elif t == "image":
                    images_b64.append(delta.data)
                    print(f"\n[image: {len(delta.data)} b64 chars]\n")
                elif t == "text_annotation":
                    # citation annotations — keep if you want to render footnotes
                    pass
            elif ev_type in ("interaction.complete", "interaction.failed", "error"):
                is_complete = True

    # 1. open the stream
    stream = client.interactions.create(
        input=query,
        agent=agent_id,
        background=True,
        stream=True,
        agent_config={
            "type": "deep-research",
            "thinking_summaries": "auto",
            # ⚠ Only "type" and "thinking_summaries" are supported by
            # types.DeepResearchAgentConfig in google-genai 1.66.0.
            # Earlier doc summaries mentioned "visualization" and
            # "collaborative_planning" — those are NOT real fields.
        },
        tools=[
            {"type": "google_search"},
            {"type": "url_context"},
            {"type": "code_execution"},
        ],
    )
    consume(stream)

    # 2. reconnect if dropped
    while not is_complete and interaction_id:
        status = client.interactions.get(interaction_id)
        if status.status == "completed":
            break
        if status.status == "failed":
            print(f"\n[FAILED] {status.error}")
            break
        if status.status == "in_progress":
            print("\n[reconnecting stream...]")
            try:
                resume = client.interactions.get(
                    id=interaction_id, stream=True, last_event_id=last_event_id,
                )
                consume(resume)
            except Exception as e:
                print(f"[reconnect error] {e}; retrying in 10s")
                time.sleep(10)
        else:
            time.sleep(10)

    final = client.interactions.get(interaction_id)

    # 3. save artifacts
    md_path = base / f"{slug}_{stamp}.md"
    md_path.write_text(
        f"# {query}\n\n"
        f"_generated: {stamp} · agent: {agent_id} · interaction: {interaction_id}_\n\n"
        + "".join(text_chunks)
    )
    print(f"\n✓ report: {md_path}")

    meta_path = base / f"{slug}_{stamp}.json"
    meta_path.write_text(json.dumps({
        "interaction_id": interaction_id,
        "timestamp": stamp,
        "agent": agent_id,
        "query": query,
        "status": final.status,
        "steps_count": len(final.steps) if getattr(final, "steps", None) else 0,
        "images_count": len(images_b64),
    }, indent=2))
    print(f"✓ metadata: {meta_path}")

    if thoughts:
        th_path = base / f"{slug}_{stamp}.thoughts.txt"
        th_path.write_text("\n\n".join(f"step {i+1}:\n{t}" for i, t in enumerate(thoughts)))
        print(f"✓ thoughts: {th_path}")

    if images_b64:
        img_dir.mkdir(parents=True, exist_ok=True)
        for i, b64 in enumerate(images_b64):
            (img_dir / f"image_{i}.png").write_bytes(base64.b64decode(b64))
        print(f"✓ images: {img_dir}")

    return final


if __name__ == "__main__":
    run_deep_research("Competitive landscape of quantum computing startups in 2025.")
```

## JavaScript equivalent

```javascript
import { GoogleGenAI } from "@google/genai";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "research";
}

export async function runDeepResearch(query, { max = false } = {}) {
  const ai = new GoogleGenAI({});
  const agent = max ? "deep-research-max-preview-04-2026" : "deep-research-preview-04-2026";

  const d = new Date();
  const stamp =
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` +
    `_${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}`;
  const slug = slugify(query);
  const base = "gemini-output/research";
  mkdirSync(base, { recursive: true });

  const textChunks = [];
  const thoughts = [];
  const imagesB64 = [];
  let lastEventId = null, complete = false, id = null;

  async function consume(stream) {
    for await (const ev of stream) {
      const evType = ev.event_type ?? ev.type;
      if (evType === "interaction.start") id = ev.interaction.id;
      if (ev.event_id) lastEventId = ev.event_id;

      const delta = ev.delta;
      if (delta) {
        if (delta.type === "text") { textChunks.push(delta.text); process.stdout.write(delta.text); }
        else if (delta.type === "thought_summary") {
          const txt = delta.content?.text ?? "";
          thoughts.push(txt);
          console.log(`\n[thought] ${txt}\n`);
        }
        else if (delta.type === "image") { imagesB64.push(delta.data); console.log(`\n[image: ${delta.data.length} chars]\n`); }
        else if (delta.type === "text_annotation") { /* citation annotation, has .annotations[] */ }
      } else if (["interaction.complete", "interaction.failed", "error"].includes(evType)) {
        complete = true;
      }
    }
  }

  const stream = await ai.interactions.create({
    input: query,
    agent,
    background: true,
    stream: true,
    agent_config: {
      type: "deep-research", thinking_summaries: "auto",
      // Only `type` and `thinking_summaries` are real fields (verified against the Python SDK
      // 1.66.0 type definitions; JS SDK shape should match). Drop `visualization` and
      // `collaborative_planning` if you see them in older snippets — not real.
    },
    tools: [{ type: "google_search" }, { type: "url_context" }, { type: "code_execution" }],
  });
  await consume(stream);

  while (!complete && id) {
    const cur = await ai.interactions.get(id);
    if (cur.status === "completed") break;
    if (cur.status === "failed") { console.log(`\n[FAILED] ${cur.error}`); break; }
    if (cur.status === "in_progress") {
      console.log("\n[reconnecting...]");
      try {
        const resume = await ai.interactions.get(id, { stream: true, last_event_id: lastEventId });
        await consume(resume);
      } catch (e) {
        console.log(`[reconnect error] ${e.message}; retrying in 10s`);
        await new Promise(r => setTimeout(r, 10000));
      }
    } else {
      await new Promise(r => setTimeout(r, 10000));
    }
  }

  const final = await ai.interactions.get(id);

  writeFileSync(join(base, `${slug}_${stamp}.md`),
    `# ${query}\n\n_generated: ${stamp} · agent: ${agent} · interaction: ${id}_\n\n` + textChunks.join("")
  );
  writeFileSync(join(base, `${slug}_${stamp}.json`), JSON.stringify({
    interaction_id: id, timestamp: stamp, agent, query, status: final.status,
    steps_count: final.steps?.length ?? 0, images_count: imagesB64.length,
  }, null, 2));
  if (thoughts.length) {
    writeFileSync(join(base, `${slug}_${stamp}.thoughts.txt`),
      thoughts.map((t, i) => `step ${i + 1}:\n${t}`).join("\n\n"));
  }
  if (imagesB64.length) {
    const dir = join(base, `${slug}_${stamp}.images`);
    mkdirSync(dir, { recursive: true });
    imagesB64.forEach((b64, i) => writeFileSync(join(dir, `image_${i}.png`), Buffer.from(b64, "base64")));
  }
  return final;
}
```

## Polling intervals

- 10 s is the recommended baseline (avoids rate limit, balances responsiveness).
- For `deep-research-max-preview-04-2026`, 15-30 s is also fine — tasks run for tens of minutes.

## Cost monitoring

Log `interaction.id` and the elapsed steps to your own log; reconcile against the Gemini billing dashboard after the run. Don't trust per-call cost estimates inside the response — they're not authoritative.
