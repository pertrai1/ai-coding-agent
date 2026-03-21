#!/usr/bin/env bash

set -euo pipefail

if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "ANTHROPIC_API_KEY is not set. Export it before running this script."
  exit 1
fi

curl https://api.anthropic.com/v1/messages \
  --silent \
  --show-error \
  --header "x-api-key: ${ANTHROPIC_API_KEY}" \
  --header "anthropic-version: 2023-06-01" \
  --header "content-type: application/json" \
  --data '{
    "model": "claude-3-5-haiku-latest",
    "max_tokens": 64,
    "messages": [
      {
        "role": "user",
        "content": "Reply with the single word: connected"
      }
    ]
  }'

echo
