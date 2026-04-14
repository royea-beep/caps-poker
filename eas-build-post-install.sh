#!/bin/bash
# Fix: route .expo/web writes to /tmp where EAS workers always have write access.
# Context: EAS workers may have .expo/web left from a prior build with wrong ownership,
# OR the project dir may be in a location where mkdir fails (non-writable root).
# Solution: create /tmp/expo-web-cache, nuke .expo, then symlink .expo/web → /tmp.

set -e

echo "[eas-build-post-install] Setting up .expo/web → /tmp/expo-web-cache..."

# Step 1: pre-create /tmp destination (always writable)
mkdir -p /tmp/expo-web-cache
chmod 777 /tmp/expo-web-cache

# Step 2: clear stale .expo (best effort — may be owned by different UID)
sudo rm -rf .expo 2>/dev/null || rm -rf .expo 2>/dev/null || true

# Step 3: recreate fresh .expo and symlink web → /tmp
mkdir -p .expo
ln -sfn /tmp/expo-web-cache .expo/web

echo "[eas-build-post-install] Done. .expo/web → /tmp/expo-web-cache"
