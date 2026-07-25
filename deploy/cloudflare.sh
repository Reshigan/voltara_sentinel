#!/bin/sh
# Full Cloudflare deploy: D1 database + schema + Worker + static assets.
# Idempotent — safe to re-run.
set -e
# Auth: an API token, or a global key + email — wrangler accepts either.
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] && { [ -z "${CLOUDFLARE_API_KEY:-}" ] || [ -z "${CLOUDFLARE_EMAIL:-}" ]; }; then
  echo "set CLOUDFLARE_API_TOKEN, or CLOUDFLARE_API_KEY + CLOUDFLARE_EMAIL" >&2
  exit 1
fi
mkdir -p public

# 1. database — already-exists is not an error
bunx wrangler d1 create "build-spec-summary-voltara-is-a-self-con-db" 2>/dev/null || true

# 2. wire the real database id into wrangler.jsonc, once.
# NB: resolve the uuid via `d1 list --json` parsed with bun (jq may be absent) —
# `d1 info <name>` reads the id from wrangler.jsonc and fails on the placeholder.
# Works whether the database was just created or already existed.
if grep -q PLACEHOLDER_DB_ID wrangler.jsonc; then
  LIST=$(bunx wrangler d1 list --json 2>/dev/null || true)
  ID=$(LIST="$LIST" DB_NAME="build-spec-summary-voltara-is-a-self-con-db" bun -e 'let id = ""; try { const d = JSON.parse(process.env.LIST); const hit = (Array.isArray(d) ? d : (d.result ?? [])).find((x) => x && x.name === process.env.DB_NAME); if (hit) id = hit.uuid ?? hit.id ?? ""; } catch {} console.log(id)')
  # fallback: sed-scrape the uuid out of the raw list output
  [ -n "$ID" ] || ID=$(echo "$LIST" | grep -B2 '"name": "build-spec-summary-voltara-is-a-self-con-db"' | grep -o '"uuid": *"[^"]*"' | head -1 | sed 's/.*"uuid": *"//;s/"//')
  [ -n "$ID" ] || { echo "could not resolve build-spec-summary-voltara-is-a-self-con-db uuid" >&2; exit 1; }
  sed -i.bak "s/PLACEHOLDER_DB_ID/$ID/" wrangler.jsonc && rm -f wrangler.jsonc.bak
fi

# 3. schema
[ -d migrations ] && bunx wrangler d1 migrations apply "build-spec-summary-voltara-is-a-self-con-db" --remote

# ship it
# NB: no `tee /dev/stderr` and no curl — neither exists in the build container.
OUT=$(bunx wrangler deploy 2>&1) || { echo "$OUT" >&2; exit 1; }
echo "$OUT"
URL=$(echo "$OUT" | grep -o 'https://[^ ]*\.workers\.dev' | head -1)

# canary — a deploy that 500s on a route it ships did not deploy. 4xx passes:
# auth-gated routes legitimately 401.
if [ -n "$URL" ]; then
  sleep 3
  for P in "/"; do
    STATUS=$(URL="$URL$P" bun -e 'const r = await fetch(process.env.URL).catch(() => null); console.log(r ? r.status : 0)')
    if [ "$STATUS" -ge 500 ] || [ "$STATUS" -eq 0 ]; then
      echo "canary FAILED: GET $URL$P returned $STATUS" >&2
      exit 1
    fi
    echo "canary ok: GET $URL$P -> $STATUS"
  done
  echo "DEPLOYED $URL"
fi
