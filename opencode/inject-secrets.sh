#!/usr/bin/env bash
# Hydrate opencode.json from template using sops-encrypted secrets
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TPL="$SCRIPT_DIR/opencode.json.tpl"
OUT="$SCRIPT_DIR/opencode.json"
SECRETS="$CONFIG_DIR/secrets/context7_api_key.yaml"

if [ ! -f "$TPL" ]; then
  echo "error: template not found at $TPL" >&2
  exit 1
fi

if [ ! -f "$SECRETS" ]; then
  echo "error: sops secret not found at $SECRETS" >&2
  exit 1
fi

if ! command -v sops &>/dev/null; then
  echo "error: sops is not installed" >&2
  exit 1
fi

CONTEXT7_KEY="$(sops -d --extract '["CONTEXT7_API_KEY"]' "$SECRETS")"

sed "s|__CONTEXT7_API_KEY__|${CONTEXT7_KEY}|g" "$TPL" > "$OUT"

echo "opencode.json generated successfully"
