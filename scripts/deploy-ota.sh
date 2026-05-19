#!/bin/bash
# deploy-ota.sh — Deploy OTA update and log to Supabase
# Usage: bash scripts/deploy-ota.sh "fix: description of change"

set -e

MESSAGE="${1:-hotfix}"

echo "⚡ Deploying OTA update: $MESSAGE"
eas update --branch production --environment production --message "$MESSAGE"

# Log to Supabase deploy_log (silent fail)
VERSION=$(node -e "console.log(require('./app.json').expo.version)" 2>/dev/null || echo "?")
BUILD=$(node -e "console.log(require('./app.json').expo.extra?.buildNumber || '?')" 2>/dev/null || echo "?")
COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "?")
SUPABASE_URL="${EXPO_PUBLIC_SUPABASE_URL:-https://gxrpunvhjcrzqnitbqah.supabase.co}"
SUPABASE_KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}"

if [ -n "$SUPABASE_KEY" ]; then
  curl -s -X POST "${SUPABASE_URL}/rest/v1/deploy_log" \
    -H "apikey: $SUPABASE_KEY" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"ota\",\"version\":\"${VERSION}\",\"build_number\":\"${BUILD}\",\"commit_hash\":\"${COMMIT}\",\"message\":\"${MESSAGE}\"}" \
    > /dev/null && echo "✅ Logged to Supabase deploy_log" || echo "⚠️  Supabase log failed (non-fatal)"
fi

# ─── Web deploy is handled by CI ───
# .github/workflows/web-deploy.yml auto-fires on push to main and deploys
# caps.ftable.co.il via Vercel (project "dist", prj_Xs2oTTRhOc0AXKiiJhzy4dRo3juP).
# DO NOT FTP to /home/ftableco/public_html/caps — that path is NOT served
# (caps.ftable.co.il DNS → 76.76.21.21 = Vercel, per infra_cpanel_spd memory).
#
# For an ad-hoc web deploy WITHOUT a git push:
#   npx expo export --platform web --output-dir dist --clear
#   node scripts/fix-web-html.js
#   cd dist && npx vercel --prod --yes --token "$VERCEL_TOKEN"

echo "✅ OTA deployed: $MESSAGE"
echo "ℹ️  Web deploy to caps.ftable.co.il will run automatically via"
echo "   .github/workflows/web-deploy.yml on next push to main."
