# Build Notes

## 2026-05-03 16:35 IL — Retry b450

Build 450 (commit 447765c) uploaded to Apple at 11:18 UTC successfully but did not become VALID in ASC API within 45 minutes. Triggering fresh build to retry the same 3 architectural fixes:

- Card V2 width-based fonts (d119b74)
- PLAYER_HAND_H dynamic (7c42245)
- Board overflow visible (447765c)

Apple Delivery UUID for b450: 62810657-968d-4fcf-8f59-1315123ea201
