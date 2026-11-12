#!/usr/bin/env bash
# Copies GOOGLE_GENERATIVE_AI_API_KEY from .env.local (gitignored) to the Vercel project's Production
# environment. The key is never printed. Run from the bevcast-ai folder:
#
#   bash scripts/push-gemini-key.sh
#
set -euo pipefail
cd "$(dirname "$0")/.."

KEY="$(grep -E '^GOOGLE_GENERATIVE_AI_API_KEY=' .env.local 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r\n"' || true)"
if [ -z "${KEY}" ]; then
  echo "No key found. Paste it after GOOGLE_GENERATIVE_AI_API_KEY= in .env.local, save, and run this again."
  exit 1
fi

vercel env rm GOOGLE_GENERATIVE_AI_API_KEY production -y >/dev/null 2>&1 || true
printf '%s' "${KEY}" | vercel env add GOOGLE_GENERATIVE_AI_API_KEY production >/dev/null
echo "Done: GOOGLE_GENERATIVE_AI_API_KEY is now set on Vercel (Production). Tell Claude to continue."
