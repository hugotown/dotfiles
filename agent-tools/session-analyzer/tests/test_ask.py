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
