---
name: vps-web-search
description: 'Search the internet from this VPS via bash. Use for any web search, news lookup, image search, current prices/rates, docs lookup, fact-checking, or scraping a URL. Triggers: "busca en internet", "search the web", "qué dice X sitio", "noticias de", "precio actual", "última versión de".'
---

# VPS Web Search

All searches exit through the DataImpulse rotating proxy (new IP per request → no rate limits).

## Setup (once per shell; already in `~/.bashrc`)

```bash
export DI_PROXY="http://${DI_LOGIN}:${DI_SEC}@${DI_HOST}:${DI_PORT}"
export DDGS_PROXY="$DI_PROXY"
```

`DDGS_PROXY` proxies **only** search traffic. Never export `HTTPS_PROXY` globally — it would route LLM API calls through residential IPs.

## Pick one

| Need | Command | Output | LLM |
|---|---|---|---|
| Web results (structured) | `websearch.sh web "<q>" [n]` | JSON | no |
| News / headlines | `websearch.sh news "<q>" [n]` | text | no |
| Images | `websearch.sh images "<q>" [n]` | text | no |
| Answer synthesized from search + page contents | `hermes -z "<q>" -t web` | prose | yes |

`websearch.sh` lives next to this file. Default `n` = 5.

**Prefer `websearch.sh` — it is deterministic.** Use `hermes -z` only when you need reading, comparison, or summarizing across pages.

## Examples

```bash
S=~/.config/agents/skills/vps-web-search/websearch.sh

# structured web results → JSON {title, url, description, position}
$S web "última versión estable de Python" 3
$S web "site:docs.python.org asyncio TaskGroup" 5

# pipe into jq
$S web "banxico tipo de cambio fix" 5 | jq -r '.data.web[] | "\(.title)\t\(.url)"'
$S web "postgres 18 release notes" 3 | jq -r '.data.web[0].url'

# news: each result is timestamp / title / URL
$S news "banxico tasa de interés" 5
$S images "logo rust" 3

# synthesized answer (LLM reads the pages)
hermes -z "Busca la última versión de Python y dame 3 URLs" -t web
hermes -z "Compara precios de VPS de Hetzner vs DigitalOcean hoy" -t web
hermes -z "Lee https://example.com/pricing y extrae la tabla de precios" -t web

# to a file / into a pipeline
hermes -z "Resume las noticias de IA de hoy" -t web > /tmp/ia.md
hermes -z "..." -t web --usage-file /tmp/usage.json   # audita el costo

# raw ddg, if you need its flags directly
ddg -q "rust lang" -l 5 -b news -p "$DI_PROXY" | sed -E 's/\x1b\[[0-9;]*[mGK]//g'
```

## Rules

- `ddg` default backend (`auto`) returns only Wikipedia related-topics and is often **empty**; `-b lite` is **broken**. Only `-b news` and `-b images` are usable. `websearch.sh` already enforces this.
- `ddg` colors its output — always strip ANSI before piping.
- `websearch.sh web` returns `{"success": false, "error": ...}` on failure with exit 0 → check `.success` with `jq`, not `$?`.
- `ddg` exits `1` on network failure; `websearch.sh` exits `2` on a bad mode.
- Search snippets carry stale dates. For anything time-sensitive, open the URL (`hermes -z "Lee <url> y ..."`) instead of trusting the snippet.

## Verify

```bash
curl -s -x "$DI_PROXY" https://api.ipify.org   # proxy IP, differs each call
~/.config/agents/skills/vps-web-search/websearch.sh web "test" 1 | jq .success   # → true
```
