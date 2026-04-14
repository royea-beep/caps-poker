#!/bin/bash
# Clean stale .expo directory left by previous EAS builds on shared workers.
# Previous builds may have created .expo/web with different user ownership,
# causing EACCES during the prebuild phase (withIosDangerousBaseMod).
echo "[eas-build-post-install] Cleaning stale .expo directory..."
sudo rm -rf .expo 2>/dev/null || rm -rf .expo 2>/dev/null || true
echo "[eas-build-post-install] Done."
