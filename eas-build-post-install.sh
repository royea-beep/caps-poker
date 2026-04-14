#!/bin/bash
# Route .expo/web writes to /tmp (avoids EACCES on EAS workers with stale .expo state).
# All commands best-effort — no set -e so this script never blocks the build.

echo "[eas-build-post-install] Setting up .expo/web → /tmp/expo-web-cache..."

mkdir -p /tmp/expo-web-cache 2>/dev/null || true
chmod 777 /tmp/expo-web-cache 2>/dev/null || true

# Clear stale .expo best-effort (may be owned by different UID on reused worker)
sudo rm -rf .expo 2>/dev/null || rm -rf .expo 2>/dev/null || true

# Recreate .expo — mkdir -p returns 0 even if dir exists, so this is safe
mkdir -p .expo 2>/dev/null || true

# Force-remove .expo/web before symlinking — prevents ln from writing INSIDE
# an existing directory (which would create a nested link instead of replacing it)
rm -rf .expo/web 2>/dev/null || true
ln -sf /tmp/expo-web-cache .expo/web 2>/dev/null || true

echo "[eas-build-post-install] Done. .expo/web → /tmp/expo-web-cache"
