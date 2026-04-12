# `/oc-observe` Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a custom OpenCode command `/oc-observe` that provides observability, measurement, and improvement recommendations by analyzing the OpenCode SQLite database.

**Architecture:** A single `.md` file at `~/.config/opencode/commands/oc-observe.md` using the OpenCode custom command pattern (frontmatter + system prompt + `!` backtick SQL injection + `$ARGUMENTS` for natural language queries). Uses `opencode/gpt-4o-mini` as the analysis model with `subtask: true`.

**Tech Stack:** OpenCode custom commands, SQLite via `opencode db`, markdown prompt engineering.

---

## File Structure

- **Create:** `~/.config/opencode/commands/oc-observe.md` — the entire command in a single file

---

### Task 1: Create the command file with frontmatter and system prompt

**Files:**
- Create: `~/.config/opencode/commands/oc-observe.md`

- [ ] **Step 1: Create the command file with frontmatter**

Create `~/.config/opencode/commands/oc-observe.md` with the following content:

```markdown
---
description: OpenCode observability — health report, metrics, diagnostics, and improvement recommendations
model: openai/gpt-4o-mini
subtask: true
---

You are an OpenCode usage analyst. You analyze metrics from an OpenCode SQLite database and produce health reports with actionable recommendations.

## Your Role

- Interpret raw SQL output (TSV format with headers) to identify patterns, anomalies, and improvement opportunities
- Compare current vs previous periods to detect trends
- Flag metrics that exceed health thresholds
- Produce specific, actionable recommendations with estimated impact
- When the user asks a specific question via $ARGUMENTS, focus your analysis there while still using all available data
- Communicate in Spanish (the user's language) but keep technical terms in English

## Health Benchmarks

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| Cost/day | < $8 | $8-15 | > $15 |
| Tool error rate | < 5% | 5-10% | > 10% |
| Todo completion | > 85% | 70-85% | < 70% |
| Session cost | < $15 | $15-30 | > $30 |
| Edit error rate | < 3% | 3-8% | > 8% |

Note: Some providers (e.g., github-copilot) report cost as $0. When cost is 0 for all recent data, focus analysis on token efficiency, error rates, and productivity metrics instead of cost.

## Output Format

When no specific question is asked, produce a full health report:

# OpenCode Health Report — [date]

## Snapshot
- Total summary of key metrics

## Trends (current week vs previous)
- Period-over-period comparisons with directional indicators

## Alerts
- Metrics exceeding warning/critical thresholds with root cause analysis

## Recommendations
1. [Specific action + file/config to change + estimated impact]
2. [Specific action + file/config to change + estimated impact]
3. [Specific action + file/config to change + estimated impact]

When a specific question IS asked, answer it directly using the data, then add relevant alerts and recommendations.

## Recommendation Quality

Each recommendation MUST be:
- Specific: not "reduce errors" but "add this instruction to AGENTS.md: ..."
- Actionable: include the exact change, command, or config modification
- Impact-estimated: "this should reduce edit error rate from X% to ~Y%"
```

- [ ] **Step 2: Verify the frontmatter is valid**

Open the file and confirm:
- `description` field is present and descriptive
- `model` is set to `openai/gpt-4o-mini`
- `subtask` is `true`
- The YAML frontmatter is properly delimited with `---`

---

### Task 2: Add SQL data collection blocks

**Files:**
- Modify: `~/.config/opencode/commands/oc-observe.md`

Append the following data collection sections after the system prompt. Each block uses `!` backtick syntax to execute SQL via `opencode db` and inject the results as context.

- [ ] **Step 1: Add Block 1 — Overview**

Append to the file:

```markdown
## DATA: Overview

!`opencode db "SELECT (SELECT COUNT(*) FROM session) as total_sessions, (SELECT COUNT(*) FROM message) as total_messages, (SELECT COUNT(*) FROM part) as total_parts, (SELECT CAST((MAX(time_created) - MIN(time_created)) / 86400000.0 AS INTEGER) FROM message) as days_active, (SELECT ROUND(SUM(json_extract(data, '$.cost')), 2) FROM part WHERE json_extract(data, '$.type') = 'step-finish') as total_cost" --format tsv`
```

- [ ] **Step 2: Add Block 2 — Cost per model (current + previous 7 days)**

Append to the file:

```markdown
## DATA: Cost per model — current week (last 7 days)

!`opencode db "SELECT json_extract(m.data, '$.modelID') as model, json_extract(m.data, '$.providerID') as provider, COUNT(*) as steps, ROUND(SUM(json_extract(p.data, '$.cost')), 2) as total_cost, SUM(json_extract(p.data, '$.tokens.total')) as total_tokens, SUM(json_extract(p.data, '$.tokens.input')) as input_tokens, SUM(json_extract(p.data, '$.tokens.output')) as output_tokens FROM part p JOIN message m ON p.message_id = m.id WHERE json_extract(p.data, '$.type') = 'step-finish' AND m.time_created > (strftime('%s', 'now', '-7 days')) * 1000 GROUP BY model, provider ORDER BY total_tokens DESC" --format tsv`

## DATA: Cost per model — previous week (7-14 days ago)

!`opencode db "SELECT json_extract(m.data, '$.modelID') as model, json_extract(m.data, '$.providerID') as provider, COUNT(*) as steps, ROUND(SUM(json_extract(p.data, '$.cost')), 2) as total_cost, SUM(json_extract(p.data, '$.tokens.total')) as total_tokens FROM part p JOIN message m ON p.message_id = m.id WHERE json_extract(p.data, '$.type') = 'step-finish' AND m.time_created BETWEEN (strftime('%s', 'now', '-14 days')) * 1000 AND (strftime('%s', 'now', '-7 days')) * 1000 GROUP BY model, provider ORDER BY total_tokens DESC" --format tsv`
```

- [ ] **Step 3: Add Block 3 — Cost per agent**

Append to the file:

```markdown
## DATA: Cost and usage per agent

!`opencode db "SELECT json_extract(m.data, '$.agent') as agent, COUNT(DISTINCT m.session_id) as sessions, COUNT(DISTINCT m.id) as messages, ROUND(SUM(json_extract(p.data, '$.cost')), 2) as cost, SUM(json_extract(p.data, '$.tokens.total')) as tokens FROM message m JOIN part p ON p.message_id = m.id WHERE json_extract(m.data, '$.role') = 'assistant' AND json_extract(p.data, '$.type') = 'step-finish' GROUP BY agent ORDER BY tokens DESC" --format tsv`
```

- [ ] **Step 4: Add Block 4 — Tool error rates**

Append to the file:

```markdown
## DATA: Tool error rates

!`opencode db "SELECT json_extract(data, '$.tool') as tool_name, COUNT(*) as total_calls, SUM(CASE WHEN json_extract(data, '$.state.status') = 'error' THEN 1 ELSE 0 END) as errors, ROUND(100.0 * SUM(CASE WHEN json_extract(data, '$.state.status') = 'error' THEN 1 ELSE 0 END) / COUNT(*), 2) as error_rate_pct FROM part WHERE json_extract(data, '$.type') = 'tool' GROUP BY tool_name ORDER BY total_calls DESC" --format tsv`

## DATA: Top 15 most frequent error messages

!`opencode db "SELECT json_extract(data, '$.tool') as tool, SUBSTR(json_extract(data, '$.state.error'), 1, 150) as error_msg, COUNT(*) as cnt FROM part WHERE json_extract(data, '$.type') = 'tool' AND json_extract(data, '$.state.status') = 'error' GROUP BY tool, error_msg ORDER BY cnt DESC LIMIT 15" --format tsv`
```

- [ ] **Step 5: Add Block 5 — Daily trend (last 14 days)**

Append to the file:

```markdown
## DATA: Daily trend (last 14 days)

!`opencode db "SELECT date(m.time_created/1000, 'unixepoch', 'localtime') as day, COUNT(DISTINCT m.session_id) as sessions, ROUND(SUM(json_extract(p.data, '$.cost')), 2) as cost, SUM(json_extract(p.data, '$.tokens.total')) as tokens, SUM(json_extract(p.data, '$.tokens.output')) as output_tokens FROM part p JOIN message m ON p.message_id = m.id WHERE json_extract(p.data, '$.type') = 'step-finish' AND m.time_created > (strftime('%s', 'now', '-14 days')) * 1000 GROUP BY day ORDER BY day" --format tsv`
```

- [ ] **Step 6: Add Block 6 — Most expensive/token-heavy sessions (top 10)**

Append to the file:

```markdown
## DATA: Top 10 sessions by token usage

!`opencode db "SELECT s.id, SUBSTR(s.title, 1, 60) as title, json_extract(m.data, '$.modelID') as primary_model, ROUND(SUM(json_extract(p.data, '$.cost')), 2) as cost, SUM(json_extract(p.data, '$.tokens.total')) as tokens, COUNT(*) as steps, date(s.time_created/1000, 'unixepoch', 'localtime') as created FROM part p JOIN message m ON p.message_id = m.id JOIN session s ON m.session_id = s.id WHERE json_extract(p.data, '$.type') = 'step-finish' GROUP BY s.id ORDER BY tokens DESC LIMIT 10" --format tsv`
```

- [ ] **Step 7: Add Block 7 — Productivity metrics**

Append to the file:

```markdown
## DATA: Todo completion rates

!`opencode db "SELECT status, COUNT(*) as cnt, ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM todo), 2) as pct FROM todo GROUP BY status" --format tsv`

## DATA: Code changes summary

!`opencode db "SELECT SUM(summary_additions) as total_additions, SUM(summary_deletions) as total_deletions, SUM(summary_files) as total_files_changed FROM session" --format tsv`

## DATA: Projects

!`opencode db "SELECT p.id, SUBSTR(p.worktree, 1, 60) as worktree, p.name, COUNT(DISTINCT s.id) as sessions, ROUND(SUM(json_extract(pt.data, '$.cost')), 2) as cost, SUM(json_extract(pt.data, '$.tokens.total')) as tokens FROM project p LEFT JOIN session s ON s.project_id = p.id LEFT JOIN message m ON m.session_id = s.id LEFT JOIN part pt ON pt.message_id = m.id AND json_extract(pt.data, '$.type') = 'step-finish' GROUP BY p.id ORDER BY tokens DESC" --format tsv`
```

- [ ] **Step 8: Add the user query section**

Append to the file at the very end:

```markdown
## User Query

$ARGUMENTS
```

---

### Task 3: Validate the command works end-to-end

**Files:**
- Read: `~/.config/opencode/commands/oc-observe.md`

- [ ] **Step 1: Verify the complete file is well-formed**

Read the full file and verify:
1. Frontmatter is valid YAML between `---` delimiters
2. All `!` backtick blocks have matching backticks
3. All SQL queries use double quotes (not single) for string delimiters inside the `opencode db "..."` call
4. No unescaped special characters that would break the shell
5. `$ARGUMENTS` is at the end of the file

- [ ] **Step 2: Test each SQL query individually**

Run each SQL query from the data blocks independently via `opencode db "..."` to verify they return valid TSV output. Fix any syntax errors.

Expected: Each query returns header row + data rows in TSV format.

- [ ] **Step 3: Test the command invocation**

Run the command:
```bash
opencode run --command oc-observe
```

Expected: A full health report in Spanish with Snapshot, Trends, Alerts, and Recommendations sections.

- [ ] **Step 4: Test with arguments**

Run the command with a natural language query:
```bash
opencode run --command oc-observe "which tool has the highest error rate and why"
```

Expected: A focused analysis of tool error rates with specific recommendations.

- [ ] **Step 5: Commit**

```bash
git add commands/oc-observe.md
git commit -m "feat: add /oc-observe command for usage observability and diagnostics"
```
