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
- **Cover photo**: no landscape hero image exists in the repo. `_preview_felt.png` at the repo
  root was checked and is a portrait gameplay screenshot with UI chrome (score, buttons, "PLACE
  12 CARDS" banner) — not hero material. Left unset rather than uploading something wrong.

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
