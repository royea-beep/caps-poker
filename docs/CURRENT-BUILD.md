# CAPS Current Build (auto-generated)

**Last refresh:** 2026-06-21T15:46:50.936Z

| Field | Value |
|-------|-------|
| App version | 2.7.0 |
| iOS Build | **445** (FINISHED) |
| iOS build runtime | 2.0.0 |
| Android versionCode | ? |
| Runtime version | 2.7.0 |
| Latest OTA hash | `1871bb75-2fe5-4dcb-a425-f2e44b333d75` |
| Latest OTA message | "crash: persist componentStack + keep_fnames" (2 hours ago by royea) |
| OTA runtime | 2.7.0 |
| OTA reaches latest build? | ❌ NO — runtime mismatch (OTA reaches no one) |
| OTA created at | ? |

## Iron Rule #26 reminder
NEVER trust app.json buildNumber. EAS auto-increments in the cloud. This file is the ONLY
source of truth besides the device's `Application.nativeBuildVersion`.

## Notes
- iOS FINISHED build: 445. Latest overall: 449 (ERRORED).
- eas build:list android returned empty or failed
- 🚨 RUNTIME MISMATCH: latest OTA runtime 2.7.0 != latest FINISHED iOS build runtime 2.0.0 — the OTA will NOT reach that build. Ship a build at runtime 2.7.0 before relying on OTA delivery.
