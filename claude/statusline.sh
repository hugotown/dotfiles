#!/bin/bash
# Claude Code Status Line Script
# Displays: Parent/Current Dir | Model | Git Branch | Context Usage | Cost

input=$(cat)

# Extract values using jq
MODEL_DISPLAY=$(echo "$input" | jq -r '.model.display_name // "Claude"')
CURRENT_DIR=$(echo "$input" | jq -r '.workspace.current_dir // empty')
INPUT_TOKENS=$(echo "$input" | jq -r '.context_window.total_input_tokens // 0')
OUTPUT_TOKENS=$(echo "$input" | jq -r '.context_window.total_output_tokens // 0')
COST=$(echo "$input" | jq -r '.cost.total_cost_usd // 0')

# Get parent and current directory names
DIR_INFO=""
if [ -n "$CURRENT_DIR" ]; then
  CURRENT_NAME=$(basename "$CURRENT_DIR")
  PARENT_DIR=$(dirname "$CURRENT_DIR")
  PARENT_NAME=$(basename "$PARENT_DIR")
  if [ "$PARENT_NAME" = "/" ]; then
    DIR_INFO="/$CURRENT_NAME"
  else
    DIR_INFO="$PARENT_NAME/$CURRENT_NAME"
  fi
fi

# Get git branch if in a git repo
GIT_INFO=""
if [ -n "$CURRENT_DIR" ] && [ -d "$CURRENT_DIR" ]; then
  cd "$CURRENT_DIR" 2>/dev/null
  if git rev-parse --git-dir >/dev/null 2>&1; then
    BRANCH=$(git branch --show-current 2>/dev/null)
    if [ -n "$BRANCH" ]; then
      # Check for uncommitted changes
      if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
        GIT_INFO=" | 🍂  $BRANCH*"
      else
        GIT_INFO=" | 🍂 $BRANCH"
      fi
    fi
  fi
fi

# Format cost (show 4 decimal places)
COST_FMT=$(printf "%.4f" "$COST")

# Build status line
if [ -n "$DIR_INFO" ]; then
  echo " 📁 $DIR_INFO | 🧠 [$MODEL_DISPLAY]$GIT_INFO | 💲 \$${COST_FMT}"
else
  echo " 🧠 [$MODEL_DISPLAY]$GIT_INFO | 💲 \$${COST_FMT}"
fi
