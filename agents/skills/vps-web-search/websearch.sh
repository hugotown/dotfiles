#!/usr/bin/env bash
# Deterministic web search on this VPS. Usage: websearch.sh <mode> <query> [limit]
#   mode: web (JSON) | news (text) | images (text)
# All traffic exits via the DataImpulse rotating proxy.
set -euo pipefail

MODE="${1:?mode: web|news|images}"
QUERY="${2:?query}"
LIMIT="${3:-5}"

: "${DI_LOGIN:?DI_LOGIN not set (see ~/.bashrc)}"
: "${DI_SEC:?DI_SEC not set}"
PROXY="http://${DI_LOGIN}:${DI_SEC}@${DI_HOST:-gw.dataimpulse.com}:${DI_PORT:-823}"

case "$MODE" in
  web)
    cd /usr/local/lib/hermes-agent
    DDGS_PROXY="$PROXY" ./venv/bin/python -c '
import sys
from tools.web_tools import web_search_tool
print(web_search_tool(sys.argv[1], limit=int(sys.argv[2])))
' "$QUERY" "$LIMIT"
    ;;
  news|images)
    ddg -q "$QUERY" -l "$LIMIT" -b "$MODE" -p "$PROXY" \
      | sed -E 's/\x1b\[[0-9;]*[mGK]//g'
    ;;
  *)
    echo "mode must be web|news|images" >&2; exit 2 ;;
esac
