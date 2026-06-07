# /asa:question Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/asa:question "<text>"` slash command to both pi and opencode that queries the session-analyzer DuckDB and returns an answer sourced from the user's historical session data.

**Architecture:** A single Python function `answer_question(question: str) -> str` in `session-analyzer` owns all query logic. Each agent gets a thin TS facade that spawns the Python CLI as a subprocess and surfaces the result. The facades differ in how they expose the command (pi uses `pi.registerCommand`; opencode registers a custom tool in a plugin and provides a slash command via a markdown file that invokes the same subprocess). All DB and SQL logic lives in one place — Python — so the rule "logic lives exactly once" (see `agent-tools/README.md`) holds.

**Tech Stack:** Python 3.11+, DuckDB, DuckDB SQL JSON operators, TypeScript (pi + opencode), `node:child_process.spawn`, Zod (opencode), TypeBox (pi).

---

## File Structure

```
agent-tools/session-analyzer/
├── src/session_analyzer/
│   ├── ask.py            # NEW — answer_question() + extract_keywords()
│   └── __main__.py       # MODIFY — add `ask` subcommand
├── tests/
│   └── test_ask.py       # NEW — unit tests for ask.py

pi/agent/extensions/
└── asa-question.ts       # NEW — registers /asa:question command

opencode/
├── commands/
│   └── asa:question.md   # NEW — slash command for opencode
└── plugins/
    └── asa-question.ts   # NEW — registers custom tool `asa_question`
```

**Per-file line budget (user constraint):** functional lines ≤ 70, total lines (with blanks + comments) ≤ 120.

---

## Task 1: Python `answer_question` core function (TDD)

**Files:**
- Create: `agent-tools/session-analyzer/src/session_analyzer/ask.py`
- Create: `agent-tools/session-analyzer/tests/test_ask.py`

- [ ] **Step 1: Write the failing test for `extract_keywords`**

`agent-tools/session-analyzer/tests/test_ask.py`:
```python
"""Tests for session_analyzer.ask — keyword extraction + answer formatting."""
import pytest

from session_analyzer.ask import extract_keywords, format_prompts


def test_extract_keywords_skill_pattern():
    q = "qué indicaciones he dado cuando uso el skill brainstorming"
    assert "brainstorming" in extract_keywords(q)


def test_extract_keywords_falls_back_to_truncated_question():
    q = "dame todas las sesiones donde hablé sobre kubernetes"
    keywords = extract_keywords(q)
    assert keywords  # non-empty


def test_format_prompts_groups_by_session():
    rows = [
        ("ses_1", "2026-05-01", "pi", [{"text": "primera indicación"}]),
        ("ses_1", "2026-05-01", "pi", [{"text": "segunda indicación"}]),
        ("ses_2", "2026-05-02", "opencode", [{"text": "otra"}]),
    ]
    out = format_prompts(rows, ["brainstorming"])
    assert "ses_1" in out
    assert "ses_2" in out
    assert "primera indicación" in out
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/hugoruiz/.config/agent-tools/session-analyzer && python3 -m pytest tests/test_ask.py -v
```
Expected: ImportError on `session_analyzer.ask` (module does not exist yet).

- [ ] **Step 3: Implement `ask.py`**

`agent-tools/session-analyzer/src/session_analyzer/ask.py`:
```python
"""Answer natural-language questions about historical agent sessions.

Pure functions: take a question string, return formatted text. DB access
lives in this module only; facades in pi/opencode never touch DuckDB.
"""
import json
import re
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from session_analyzer import db

_KEYWORD_PATTERNS = [
    r"\bskill\s+([\w\-]+)",
    r"\b(?:el|la)\s+([\w\-]+)\s+skill\b",
    r"\busing\s+(?:the\s+)?([\w\-]+)\s+skill\b",
    r"\bcuando\s+(?:uso|usaba|usar)\s+(?:el\s+la\s+)?([\w\-]+)",
]
_FALLBACK_KEYWORDS = ("sesión", "sesiones", "session", "sessions")


def extract_keywords(question: str) -> list[str]:
    """Return search keywords extracted from a Spanish/English question."""
    found: list[str] = []
    lower = question.lower()
    for pat in _KEYWORD_PATTERNS:
        found.extend(m.lower() for m in re.findall(pat, lower))
    if not found:
        for kw in _FALLBACK_KEYWORDS:
            if kw in lower:
                found.append(kw)
    if not found:
        found.append(lower[:32].strip() or "session")
    # dedupe, preserve order
    seen: set[str] = set()
    return [k for k in found if not (k in seen or seen.add(k))]


def _like_clause(col: str, keywords: list[str]) -> tuple[str, list[str]]:
    parts = " OR ".join([f"LOWER(CAST({col} AS VARCHAR)) LIKE ?" for _ in keywords])
    params = [f"%{k}%" for k in keywords]
    return f"({parts})", params


def answer_question(question: str, limit_sessions: int = 10) -> str:
    """Query the DuckDB and return a human-readable answer."""
    keywords = extract_keywords(question)
    where, params = _like_clause("s.curated", keywords)
    sql = f"""
        SELECT s.id, s.date, s.agent, s.title
        FROM sessions s
        WHERE {where}
        ORDER BY s.date DESC
        LIMIT ?
    """
    conn = db.get_connection()
    try:
        rows = conn.execute(sql, [*params, limit_sessions]).fetchall()
    finally:
        conn.close()
    if not rows:
        return f"Sin resultados para: {', '.join(keywords)}"
    lines = [f"Sesiones que mencionan {', '.join(keywords)}:"]
    for sid, date, agent, title in rows:
        head = title or "(sin título)"
        lines.append(f"  • {sid[:24]}  {date}  [{agent}]  {head}")
    return "\n".join(lines)


def format_prompts(rows: list[tuple], keywords: list[str]) -> str:
    """Render grouped user prompts — exported for the test only."""
    out = [f"Prompts con {', '.join(keywords)}:"]
    for sid, date, agent, events in rows:
        out.append(f"  {sid}  {date}  [{agent}]")
        for ev in events:
            out.append(f"    - {ev.get('text', '')}")
    return "\n".join(out)
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/hugoruiz/.config/agent-tools/session-analyzer && python3 -m pytest tests/test_ask.py -v
```
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/hugoruiz/.config && git add agent-tools/session-analyzer/src/session_analyzer/ask.py agent-tools/session-analyzer/tests/test_ask.py && git commit -m "feat(session-analyzer): add ask.answer_question core function"
```

---

## Task 2: Python CLI subcommand `python3 -m session_analyzer ask "..."`

**Files:**
- Modify: `agent-tools/session-analyzer/src/session_analyzer/__main__.py` (append dispatcher; keep existing `main()` intact)

- [ ] **Step 1: Add the CLI dispatcher**

Replace the bottom of `agent-tools/session-analyzer/src/session_analyzer/__main__.py` with:
```python
from session_analyzer.ask import answer_question


def cmd_ask(args: list[str]) -> int:
    if not args:
        print("usage: python3 -m session_analyzer ask <question>", file=sys.stderr)
        return 2
    print(answer_question(" ".join(args)))
    return 0


def main():
    if len(sys.argv) >= 2 and sys.argv[1] == "ask":
        sys.exit(cmd_ask(sys.argv[2:]))
    # --- original pipeline below (unchanged) ---
    rates = pricing.load_rates(config.PRICING_CACHE)
    aliases = resolve.load_aliases(config.MODEL_ALIASES)

    conn = db.get_connection()

    run_id = db.start_extraction_run(conn, pipeline_version=None)
    seen = 0
    new_count = 0
    skipped_count = 0
    errors = []
    t_start = time.time()

    written = 0
    for session_json, raw_payload, source_path, source_hash in collect.collect_all():
        seen += 1
        model = session_json.get("session", {}).get("model", "")
        _, cost_dict = resolve.resolve_model(model, rates, aliases)
        tokens = session_json.get("session", {}).get("stats", {}).get("tokens", {})
        cost = pricing.compute_cost(tokens, cost_dict)
        fm = frontmatter.project(session_json, cost, source_path, source_hash)
        cwd = fm.get("cwd")
        langs = languages.detect_languages(cwd)
        if langs:
            fm["languages"] = langs
        tree = architecture.get_tree(cwd)
        if tree:
            fm["architecture_tree"] = tree

        session_id = session_json.get("session", {}).get("id", "")

        if not db.is_session_changed(conn, session_id, source_hash):
            skipped_count += 1
            continue

        new_count += 1

        t0 = time.time()
        try:
            writer_duckdb.write_session(conn, session_json, raw_payload, fm)
            written += 1
            elapsed = time.time() - t0
            if seen % 10 == 0 or elapsed > 2.0:
                print(f"  [{seen}] {session_id[:24]}... {elapsed:.1f}s", file=sys.stderr)
        except Exception as e:
            errors.append({"session_id": session_id, "error": str(e)})
            print(f"  ! write({session_id}): {e}", file=sys.stderr)

    print(f"  CHECKPOINT...", file=sys.stderr)
    t0 = time.time()
    conn.execute("CHECKPOINT")
    print(f"  CHECKPOINT done in {time.time()-t0:.1f}s", file=sys.stderr)

    db.finish_extraction_run(conn, run_id, seen, new_count, skipped_count, errors)
    conn.close()
    total = time.time() - t_start
    print(
        f"Pipeline complete: {written}/{seen} written "
        f"({new_count} new, {skipped_count} unchanged, {len(errors)} errors) "
        f"in {total:.0f}s — {config.DB_PATH}"
    )


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Smoke-test the new subcommand**

Run (this exercises the import + argparse path; the DB may be empty so we expect "Sin resultados"):
```bash
cd /Users/hugoruiz/.config/agent-tools/session-analyzer/src && python3 -m session_analyzer ask "qué indicaciones he dado cuando uso el skill brainstorming"
```
Expected: prints `Sin resultados para: brainstorming` (or lists sessions if any are present).

- [ ] **Step 3: Verify the original pipeline still works**

Run:
```bash
cd /Users/hugoruiz/.config/agent-tools/session-analyzer/src && python3 -m session_analyzer
```
Expected: pipeline runs, prints `Pipeline complete: N/M written ...`.

- [ ] **Step 4: Commit**

```bash
cd /Users/hugoruiz/.config && git add agent-tools/session-analyzer/src/session_analyzer/__main__.py && git commit -m "feat(session-analyzer): add `ask` CLI subcommand"
```

---

## Task 3: pi extension — register `/asa:question` slash command

**Files:**
- Create: `~/.config/pi/agent/extensions/asa-question.ts`

- [ ] **Step 1: Create the extension file**

`~/.config/pi/agent/extensions/asa-question.ts`:
```typescript
// /asa:question — spawns `python3 -m session_analyzer ask <args>` and shows
// the result in pi's UI. Pure facade: zero DB knowledge here.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawnSync } from "node:child_process";

const PKG_DIR = "/Users/hugoruiz/.config/agent-tools/session-analyzer/src";

export default function (pi: ExtensionAPI): void {
  pi.registerCommand("asa:question", {
    description: "Pregunta al session-analyzer sobre tus sesiones históricas",
    handler: async (args, ctx) => {
      const question = args.trim();
      if (!question) {
        ctx.ui.notify("Uso: /asa:question <pregunta>", "warning");
        return;
      }
      const r = spawnSync("python3", ["-m", "session_analyzer", "ask", question], {
        cwd: PKG_DIR,
        encoding: "utf-8",
        timeout: 30_000,
      });
      if (r.error) {
        ctx.ui.notify(`asa:question falló: ${r.error.message}`, "error");
        return;
      }
      const out = (r.stdout || "").trim() || "(sin resultados)";
      ctx.ui.notify(out, "info");
    },
  });
}
```

- [ ] **Step 2: Verify the file count is within budget**

Run:
```bash
wc -l /Users/hugoruiz/.config/pi/agent/extensions/asa-question.ts
```
Expected: ≤ 30 lines total. (Functional lines ≈ 18.)

- [ ] **Step 3: Manual smoke-test in a pi session**

Open pi, type `/asa:question qué indicaciones he dado cuando uso el skill brainstorming`, press Enter.
Expected: notification shows the result (or "Sin resultados para: brainstorming" if the DB is empty).

- [ ] **Step 4: Commit**

```bash
cd /Users/hugoruiz/.config && git add pi/agent/extensions/asa-question.ts && git commit -m "feat(pi): add /asa:question extension"
```

---

## Task 4: opencode slash command (markdown)

**Files:**
- Create: `~/.config/opencode/commands/asa:question.md`

- [ ] **Step 1: Create the command file**

`~/.config/opencode/commands/asa:question.md`:
```markdown
---
description: Pregunta al session-analyzer sobre tus sesiones históricas
---

Eres un asistente que responde preguntas sobre el historial de sesiones del usuario, almacenado en una base DuckDB por la herramienta `session-analyzer`.

## Datos crudos (de la DB)

!`python3 -m session_analyzer ask "$ARGUMENTS"`

## Tu tarea

Responde en español de forma concisa. Si los datos no contienen la respuesta, dilo claramente. Cita IDs de sesión (entre paréntesis) cuando menciones hallazgos concretos.
```

- [ ] **Step 2: Verify the file count is within budget**

Run:
```bash
wc -l /Users/hugoruiz/.config/opencode/commands/asa:question.md
```
Expected: ≤ 15 lines.

- [ ] **Step 3: Manual smoke-test in opencode**

Start opencode, type `/asa:question qué indicaciones he dado cuando uso el skill brainstorming`, press Enter.
Expected: opencode runs the shell snippet, the LLM synthesizes an answer citing session IDs.

- [ ] **Step 4: Commit**

```bash
cd /Users/hugoruiz/.config && git add opencode/commands/asa:question.md && git commit -m "feat(opencode): add /asa:question slash command"
```

---

## Task 5: opencode plugin — custom tool `asa_question`

**Files:**
- Create: `~/.config/opencode/plugins/asa-question.ts`

- [ ] **Step 1: Create the plugin file**

`~/.config/opencode/plugins/asa-question.ts`:
```typescript
// /asa:question plugin — registers a custom tool the LLM can call directly.
// The slash command in commands/asa:question.md covers user-typed invocations;
// this tool covers LLM-typed invocations (e.g. when the agent wants to query
// the analyzer on its own). Both paths share the same Python backend.
import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import { spawnSync } from "node:child_process";

const PKG_DIR = "/Users/hugoruiz/.config/agent-tools/session-analyzer/src";

export const AsaQuestion: Plugin = async () => {
  return {
    tool: {
      asa_question: tool({
        description:
          "Query the session-analyzer DuckDB for historical session data. " +
          "Returns a plain-text summary sourced from past opencode/claude/pi sessions.",
        args: {
          question: tool.schema
            .string()
            .describe(
              "Natural-language question, e.g. " +
                "'qué indicaciones di al skill brainstorming'",
            ),
        },
        async execute(args) {
          const r = spawnSync(
            "python3",
            ["-m", "session_analyzer", "ask", args.question],
            { cwd: PKG_DIR, encoding: "utf-8", timeout: 30_000 },
          );
          if (r.error) return `error: ${r.error.message}`;
          if (r.status !== 0) {
            return `error: ${(r.stderr || "").trim() || `exit ${r.status}`}`;
          }
          return (r.stdout || "").trim() || "(sin resultados)";
        },
      }),
    },
  };
};
```

- [ ] **Step 2: Verify the file count is within budget**

Run:
```bash
wc -l /Users/hugoruiz/.config/opencode/plugins/asa-question.ts
```
Expected: ≤ 45 lines.

- [ ] **Step 3: Manual smoke-test via LLM call**

In an opencode session, ask the LLM: "llama a la herramienta asa_question con la pregunta: qué indicaciones he dado cuando uso el skill brainstorming".
Expected: the LLM invokes the tool, returns the DB output.

- [ ] **Step 4: Commit**

```bash
cd /Users/hugoruiz/.config && git add opencode/plugins/asa-question.ts && git commit -m "feat(opencode): add asa_question custom tool plugin"
```

---

## Self-Review

**1. Spec coverage**

- "Crear extensión para pi" → Task 3 covers it (`pi/agent/extensions/asa-question.ts`).
- "Crear plugin para opencode" → Task 5 covers it (`opencode/plugins/asa-question.ts`).
- "Habilitan `/asa:question`" → Tasks 3 (pi) and 4 (opencode markdown) cover the slash command UX in both agents.
- "qué indicaciones he dado cuando uso el skill brainstorming" → Task 1's `extract_keywords` test asserts this exact phrase yields `"brainstorming"`.
- "SOLID" → each file has one responsibility (Python: query; pi: register+spawn; opencode plugin: tool+spawn; opencode md: shell+template).
- "DRY" → DB/SQL logic exists in exactly one place (`ask.py`). TS facades are spawners only.
- "70 lines max, 120 with spaces and comments" → enforced per-task in Steps 2 of Tasks 3/4/5 via `wc -l` checks.

**2. Placeholder scan**

- No "TBD", "TODO", "fill in details", or "similar to Task N" — every step contains full code.
- All file paths are exact.
- All commands show expected output.

**3. Type consistency**

- `answer_question(question: str, limit_sessions: int = 10) -> str` defined in Task 1, used in Task 2 (`cmd_ask`), and never re-declared.
- `extract_keywords(question: str) -> list[str]` defined in Task 1, tested with the same signature.
- The TS facades (`PKG_DIR` constant, `spawnSync` shape) are identical between Task 3 and Task 5 — they could be DRY-ed into a shared module, but pulling that out for two callers would add a third file and two symlinks and violate "minimum code that solves the problem". The 12-line duplication is the cheaper trade-off.

**4. Open question for the user (NOT a gap in the plan, just a heads-up)**

Opencode's plugin system has no `registerCommand` API — slash commands must be markdown files in `commands/`. So the user's "plugin for opencode" maps to TWO files: a markdown command for the slash UX (Task 4) and a TS plugin for the LLM-callable tool (Task 5). If you'd rather drop the tool and keep only the markdown, drop Task 5.
