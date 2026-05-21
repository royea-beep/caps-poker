---
name: caps-build-tracker
description: |
  Use whenever Claude needs to know the current CAPS build number, OTA hash, or runtime version.
  Triggers: "what build", "current version", "which OTA", "מה הbuild", "איזה בילד", session-start status line.
  Returns: { ios_build, ios_build_status, latest_build_runtime, android_versionCode, runtime_version, ota_runtime, ota_reaches_latest_build, latest_ota_hash, latest_ota_message, app_version }
  This is the SOURCE OF TRUTH — never trust app.json buildNumber directly per Iron Rule #26.
  Emits a 🚨 RUNTIME MISMATCH warning when the latest OTA runtime != latest FINISHED build runtime — in that case the OTA reaches NO device.
---

# CAPS Build Tracker

When the user or Claude needs current build info, run this from the project root:

```bash
node scripts/build-tracker.js
```

The script outputs JSON pulled from:
1. `eas build:list --platform ios --limit 1 --json --non-interactive` → latest iOS build number
2. `eas build:list --platform android --limit 1 --json --non-interactive` → latest Android versionCode
3. `eas update:list --branch production --limit 1 --json --non-interactive` → latest OTA hash + message + runtime
4. `app.json` → version string only (NOT buildNumber — that's stale; EAS auto-increments in cloud)

Output goes both to stdout AND to `docs/CURRENT-BUILD.md`.

## Iron rules for this skill

1. NEVER report a build number from `app.json` directly. Always query EAS.
2. NEVER cache a build number across sessions. Always re-run.
3. If `eas` CLI is unavailable/unauthenticated: report
   "EAS_UNAVAILABLE — user must confirm from device Settings → About".
4. The output of this skill OVERRIDES any build number in memory or context.
5. `eas build:list` / `update:list` are READ-ONLY and safe. NEVER call `eas build`
   (free-tier exhausted; builds run via GitHub Actions, not EAS).
6. If `ota_reaches_latest_build` is false (RUNTIME MISMATCH warning): the published OTA is
   reaching NO device — a build at the OTA's runtimeVersion must ship first. Surface this loudly,
   never report such an OTA as "live".
