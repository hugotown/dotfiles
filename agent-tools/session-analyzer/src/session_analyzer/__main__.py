"""session-analyzer — pipeline entry point.

Collect sessions from all agents → resolve model → compute cost → write DuckDB.
Full-scan, idempotent. Running twice produces identical output.

Run:  python3 -m session_analyzer
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from session_analyzer import config, db
from session_analyzer.ask import answer_question
from session_analyzer.pipeline import (
    architecture,
    collect,
    frontmatter,
    languages,
    pricing,
    resolve,
    timeline,
    writer_duckdb,
)


def cmd_ask(args: list[str]) -> int:
    if not args:
        print("usage: python3 -m session_analyzer ask <question>", file=sys.stderr)
        return 2
    try:
        print(answer_question(" ".join(args)))
        return 0
    except Exception as e:
        print(f"error: {e}", file=sys.stderr)
        return 1


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
