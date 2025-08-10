#!/usr/bin/env bash
set -euo pipefail

BASE=${BASE:-}
SECRET=${SECRET:-}
if [[ -z "$BASE" || -z "$SECRET" ]]; then echo "BASE and SECRET required" >&2; exit 1; fi

echo "# Health" && curl -sS -H "X-Webhook-Secret: $SECRET" "$BASE/health" | jq .
echo "# Me"     && curl -sS -H "X-Webhook-Secret: $SECRET" "$BASE/clickup.me" | jq .
echo "# Create" && curl -sS -X POST "$BASE/tasks.create" -H 'Content-Type: application/json' -H "X-Webhook-Secret: $SECRET" -d '{"title":"CI smoke test"}' | jq .


