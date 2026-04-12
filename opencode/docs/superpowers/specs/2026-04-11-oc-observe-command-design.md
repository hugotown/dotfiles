# `/oc-observe` — OpenCode Observability, Measurement & Improvement Command

**Date:** 2026-04-11
**Status:** Design approved, pending implementation

## Problem Statement

After 47 days of OpenCode usage (1,059 sessions, $473 total cost), there is no built-in way to:
1. Get visibility into cost trends, error rates, and productivity metrics
2. Compare performance across time periods
3. Identify specific problems (e.g., 11.4% edit tool error rate)
4. Receive actionable recommendations for improvement
5. Ask natural language questions about usage data

Currently, this requires manual SQL queries against `opencode.db`.

## Solution

A custom OpenCode command (`/oc-observe`) implemented as a single `.md` file that:
1. Collects metrics via SQL queries injected as context (using `!` backtick syntax)
2. Instructs the LLM to analyze, compare, and generate recommendations
3. Accepts `$ARGUMENTS` for natural language queries

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  /oc-observe [natural language query]               │
│                                                     │
│  1. SQL queries via !`opencode db "..."` inject     │
│     raw metrics as context                          │
│                                                     │
│  2. System prompt instructs the LLM on:             │
│     - How to interpret the metrics                  │
│     - Health benchmarks/thresholds                  │
│     - How to compare periods                        │
│     - Output format (structured report)             │
│                                                     │
│  3. $ARGUMENTS enables:                             │
│     /oc-observe                    → full report    │
│     /oc-observe costs this week    → cost focus     │
│     /oc-observe edit errors        → tool focus     │
│     /oc-observe compare mon vs thu → temporal       │
│                                                     │
│  4. Output: Markdown report with sections:          │
│     Snapshot, Trends, Alerts, Recommendations       │
└─────────────────────────────────────────────────────┘
```

### Key Design Decisions

- **Model:** `openai/gpt-4o-mini` — cost-efficient for structured data analysis
- **Subtask:** `true` — does not contaminate the main session context
- **Single file:** No external scripts or dependencies
- **Follows existing pattern:** Same approach as `enhance.md` command

## Data Collection (7 SQL Blocks)

### Block 1: Overview
General health metrics — total sessions, messages, parts, days active, total cost, average cost per day.

### Block 2: Cost per Model (current + previous period)
Model breakdown with steps, total cost, average cost per step, and total tokens. Two queries: last 7 days and previous 7 days, enabling period comparison.

### Block 3: Cost per Agent
Agent breakdown with sessions, messages, and cost. Identifies which agents are cost-efficient.

### Block 4: Tool Error Rates
Per-tool error rate percentages plus top 10 most frequent error messages. Key diagnostic data.

### Block 5: Daily Trend (last 14 days)
Day-by-day breakdown of sessions, cost, and tokens. Enables spike detection and trend analysis.

### Block 6: Most Expensive Sessions (top 10)
Session ID, title, project, cost, tokens, and step count. Flags outlier sessions.

### Block 7: Productivity Metrics
Todo completion rate distribution and total code changes (additions, deletions, files). Measures actual output.

## Health Benchmarks

Hardcoded thresholds in the prompt, derived from baseline data (47 days of usage):

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| Cost/day | < $8 | $8-15 | > $15 |
| Tool error rate | < 5% | 5-10% | > 10% |
| Todo completion | > 85% | 70-85% | < 70% |
| Session cost | < $15 | $15-30 | > $30 |
| Edit error rate | < 3% | 3-8% | > 8% |

These benchmarks should be manually adjusted as usage patterns evolve.

## Output Format

### Default (no arguments): Full Health Report

```markdown
# OpenCode Health Report — YYYY-MM-DD

## Snapshot
- X days active | Y sessions | $Z total
- Today: X sessions | $Y | Z tokens
- Average: $X/day

## Trends (vs previous week)
- Cost: $X → $Y (↑/↓ Z%)
- Sessions/day: X → Y
- Error rate: X% → Y%

## Alerts
- ⚠️ [metric] at [value] (threshold: [threshold])
  - Root cause analysis
  - Specific recommendation

## Recommendations
1. [Specific action + estimated impact]
2. [Specific action + estimated impact]
3. [Specific action + estimated impact]
```

### With arguments: Focused Analysis

When `$ARGUMENTS` is provided, the LLM focuses its analysis on the user's question while still having access to all metric data. Examples:
- `/oc-observe how much did I spend on aplus this week`
- `/oc-observe why is edit failing so much`
- `/oc-observe compare Monday vs Friday productivity`

## Recommendation Quality Requirements

Each recommendation must be:
- **Specific:** Not "reduce costs" but "in AGENTS.md, add instruction X to reduce edit retries"
- **Actionable:** Include the exact change to make or command to run
- **Impact-estimated:** "This should reduce edit error rate from 11% to ~3%"

## File Location

`~/.config/opencode/commands/oc-observe.md`

## Future Enhancements (out of scope)

- Persistent report history (save to `~/.local/share/opencode/reports/`)
- Scheduled execution via cron + `opencode run --command oc-observe`
- Auto-apply recommendations mode
- Custom benchmark configuration file
