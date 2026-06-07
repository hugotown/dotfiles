"""Answer natural-language questions about historical agent sessions.

Pure functions: take a question string, return formatted text. DB access
lives in this module only; facades in pi/opencode never touch DuckDB.
"""
import re
from typing import Any

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
    seen: set[str] = set()
    return [k for k in found if not (k in seen or seen.add(k))]


def _like_clause(col: str, keywords: list[str]) -> tuple[str, list[str]]:
    parts = " OR ".join([f"LOWER(CAST({col} AS VARCHAR)) LIKE ?" for _ in keywords])
    params = [f"%{k}%" for k in keywords]
    return f"({parts})", params


def answer_question(question: str, limit_sessions: int = 10) -> str:
    """Query the DuckDB and return a human-readable answer."""
    from . import db as _db

    keywords = extract_keywords(question)
    where, params = _like_clause("s.curated", keywords)
    sql = f"""
        SELECT s.id, s.date, s.agent, s.title
        FROM sessions s
        WHERE {where}
        ORDER BY s.date DESC
        LIMIT ?
    """
    conn = _db.get_connection()
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
