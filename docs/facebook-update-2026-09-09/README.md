# CAPS Poker Facebook Page — 2026-09-09

VAMOS CAPS FACEBOOK-NOW. Facebook-only update to the existing Capspokerapp Page
(facebook.com/profile.php?id=61593891042796), branch claude/vamos-caps-align-celebration-flppo0.

## Done

- **Profile picture**: set to `assets/icon.png` (the app's actual icon — gold "C" monogram,
  suits, black background, already drawn inside a circle). No literal "F icon export" file
  exists anywhere in the repo or history; this is the closest and most correct real asset.
- **Bio**: removed `no download · ` only, per instruction. Before/after below. Every other
  word left untouched.

## Not done — blocked, reported rather than guessed

- **Page name** (`Capspokerapp` → `CAPS Poker`): typed and reviewed, but Facebook's Name Change
  Request requires re-entering the account password to submit. That is a hard no regardless of
  authorization, so the edit was cancelled/reverted before submission. Live name is still
  `Capspokerapp`. Facebook's own copy says review can take "up to 3 days" and, once changed,
  the name is locked for **60 days** (not ~3 days as assumed in the brief).
- ~~**Cover photo**: no landscape hero image exists in the repo.~~ **SUPERSEDED 2026-09-09 —
  the cover is LIVE.** Uploaded by Claude Code on 2026-09-09; that session crashed before writing
  its report, so the upload's only record is the Page itself. Read back from the Page the same day: the cover slot shows the CAPS
  wordmark on green felt, the photo's own post reads "Capspokerapp updated their cover photo",
  and the button under it says *Edit* cover photo, not *Add*. The live art is
  `docs/cover-art-2026-09-09/facebook-cover-851x315.png` (851×315, generated in `61ec8742`) —
  identified BY CONTENT, not by name: it is the only cover file with a spade left of CAPS, a
  heart right of it, and the `caps.ftable.co.il` line. The older
  `docs/social/caps-cover-facebook-1640x664.png` has four suits in a row and no URL, and is NOT
  what is live. The paragraph above was true when written (the 1640×664 file was never checked
  because the search looked at the repo root, and the 851×315 file did not exist yet); it is kept
  struck through so nobody re-derives "no cover exists" from it.
  ⚠️ Do not re-upload the same file: Facebook publishes a fresh "updated their cover photo" post
  and a duplicate album photo on every upload, with no visible change. The upload procedure and
  every other Page operation now live in `docs/social/FACEBOOK-PAGE-RUNBOOK.md`.

## Bio before → after

Before:
```
Multi-board poker. Play free in your browser.

Poker played across several boards at once. Four cards on every board — win the most boards, win the hand.

Free · no download · no sign-up
caps.ftable.co.il
```

After:
```
Multi-board poker. Play free in your browser.

Poker played across several boards at once. Four cards on every board — win the most boards, win the hand.

Free · no sign-up
caps.ftable.co.il
```

## Verification

Reloaded fresh after saving. Checked both:
- **Admin view** (`admin-view-after-reload.jpg`) — logged in as the Page.
- **Visitor-equivalent view** (`visitor-view-after-reload.jpg`) — switched to the personal
  account (Roye Arguan) that is *not* acting as the Page, which sees the public-facing
  Follow/Message buttons and the same public fields a real visitor would. A true logged-out
  session wasn't available in this browser automation (no incognito control), so this is the
  closest verification possible without opening a second browser identity.

Both show the new profile picture and the corrected bio. Link, category (Video Game), and
contact email were already correct before this session and are unchanged.

Nothing was posted, no security setting was touched, no password was typed or requested.
Instagram and TikTok were not touched.
