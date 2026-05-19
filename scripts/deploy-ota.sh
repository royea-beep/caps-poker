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



# ─── Web deploy: export + FTP push to caps.ftable.co.il ───
echo ''
echo '🌐 Building web export...'
export NODE_OPTIONS="--max-old-space-size=8192"
WEB_OUT=dist
rm -rf "$WEB_OUT"
if npx expo export --platform web --output-dir "$WEB_OUT" >/tmp/expo-web-export.log 2>&1; then
  echo "✅ Web export OK ($WEB_OUT)"
else
  echo '❌ Web export FAILED — see /tmp/expo-web-export.log'
  tail -20 /tmp/expo-web-export.log
  exit 1
fi

if [ -z "${FTP_PASSWORD:-}" ]; then
  echo '⚠️  FTP_PASSWORD env not set — skipping caps.ftable.co.il upload'
  echo '   export FTP_PASSWORD="<password>" to enable web FTP deploy'
else
  echo "📤 Uploading $WEB_OUT/ to caps.ftable.co.il via FTP..."
  if python scripts/ftp_deploy.py; then
    echo '✅ Web deploy to caps.ftable.co.il complete'
  else
    echo '❌ FTP deploy FAILED'
    exit 1
  fi
fi

echo "✅ OTA deployed: $MESSAGE"
