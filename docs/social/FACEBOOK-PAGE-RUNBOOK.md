# CAPS Poker — Facebook Page Runbook

The one place that says how the Capspokerapp Facebook Page is operated: what is live, where the
assets are, how each change is made, what is refused, and how every change is verified. Written
2026-09-09 after three Page sessions (profile + bio, first post, cover). **Update the "Live
state" table in the same commit as any Page change** — a runbook that lags the Page is the
"filename is not evidence" trap in prose.

---

## 1. Identity

| | |
|---|---|
| Page | **Capspokerapp** |
| URL | https://www.facebook.com/profile.php?id=61593891042796 |
| Page id | `61593891042796` |
| Category | Video Game |
| Link in bio | `caps.ftable.co.il` |
| Operated from | Chrome, logged in as the Page (the "Manage Page" rail shows on the left). The personal account **Roye Arguan** is the non-admin identity used for visitor-view checks. |
| Instagram | **No `capspokerapp` session.** Chrome is logged in as `featuretable1`. Nothing has ever been posted. |
| TikTok | **No session**, and `@capspokerapp` does not resolve. Nothing has ever been posted. |

The Page name is still `Capspokerapp`, not `CAPS Poker`. See §5 — the rename is blocked, not
forgotten.

## 2. Live state (read from the Page, not from memory)

| Surface | Live value | Source file | Set on |
|---|---|---|---|
| Profile picture | Gold "C" monogram, suits, black circle | `assets/icon.png` (1024×1024, the shipped app icon) | 2026-09-09 |
| Cover photo | CAPS wordmark, spade left / heart right, POKER, `caps.ftable.co.il`, green felt | `docs/cover-art-2026-09-09/facebook-cover-851x315.png` (851×315) | 2026-09-09 |
| Bio | see §6 | — | 2026-09-09 |
| Posts | **One**: the explainer, auto-classified as a Reel — https://www.facebook.com/reel/1713831943032204 | Supabase Storage `bly-review/caps/caps-explainer-FINAL.mp4`, sha256 `fb456341…`, 5,358,156 bytes | 2026-09-09 |
| Followers | 0 following / 0 followers at last read | — | — |

**How the cover was identified.** Two cover files exist in the repo and both are green felt with a
gold CAPS. They differ by content: `docs/social/caps-cover-facebook-1640x664.png` has **four
suits in a row above the wordmark and no URL**; the 851×315 file has **one spade left, one heart
right, and the URL line**. The Page shows the second. Check the same way next time — never by
which file is newer.

## 3. Assets and where they live

| File | Pixels (read, not from the name) | For |
|---|---|---|
| `assets/icon.png` | 1024×1024 | profile picture — LIVE |
| `docs/cover-art-2026-09-09/facebook-cover-851x315.png` | 851×315 | cover — LIVE |
| `docs/cover-art-2026-09-09/facebook-cover-with-avatar-overlay.png` | 851×315 | preview only: proves the wordmark clears the profile circle and the mobile crop. Never upload. |
| `docs/cover-art-2026-09-09/facebook-cover-phone-size-390w.png` | 390×144 | preview only |
| `docs/cover-art-2026-09-09/vertical-cover-1080x1920.png` | 1080×1920 | IG / TikTok reel cover, unused (no sessions) |
| `docs/social/caps-cover-facebook-1640x664.png` | 1640×664 | earlier cover candidate, NOT live |
| `docs/social/caps-cover-wide-1920x1080.png` | 1920×1080 | general landscape hero, unused |
| `docs/social/caps-profile-facebook-360.png` | 360×360 | earlier profile candidate, NOT live (the app icon was used instead) |

Before uploading anything, read its real size:

```bash
python -c "import struct,sys;f=open(sys.argv[1],'rb');f.read(16);print(struct.unpack('>II',f.read(8)))" <file.png>
```

## 4. Procedures

Every procedure starts the same way: open the Page URL, confirm the left rail says **Manage
Page / Capspokerapp** (if it shows the personal feed, switch identity via the avatar menu
first), and take a screenshot of the surface **before** touching it.

### 4a. Change the cover photo

1. Read the file's pixel size (§3). Facebook's floor is 400×150; the desktop slot renders at
   roughly 820×312, so the 851×315 art is shown at about 1:1 and is not upscaled. Mobile crops
   the sides — that is what the avatar-overlay and 390w previews exist to check.
2. Compare the file to what is live by content (§2). **If it is the same art, stop.** Every
   upload publishes a new "updated their cover photo" post and a duplicate album photo, even when
   nothing visible changes.
3. On the Page, the cover carries an **Edit cover photo** button (bottom-right of the cover).
   Behind it is a file input labelled "Add cover photo". In browser automation, do not click the
   button — it opens a native picker. Use the file-upload tool against the file input's ref.
4. Facebook shows a reposition step. Leave it centred; the art is built for the 851×315 crop and
   the avatar-overlay preview proves the wordmark clears the profile circle.
5. Save. Verify per §7.

### 4b. Change the profile picture

Same shape as 4a. The input sits behind the camera icon on the profile circle. Use a square
source; Facebook crops to a circle, so the mark must sit well inside the inscribed circle
(`assets/icon.png` does — it is drawn inside a circle already; the `docs/social` profiles were
proven to keep a quarter-radius of clearance).

### 4c. Edit the bio / link / category

**Edit** button under the Page name → the details sheet. Change only the field asked for, save,
verify per §7. The bio text of record is in §6; paste from there, not from memory.

### 4d. Post a video

1. **Verify the file before trusting its name.** Download it, check byte size and sha256 against
   the record in §2, and run `ffprobe`. Three different files have worn the name
   `caps-explainer-FINAL.mp4`.
2. Extract the last second with ffmpeg and read the end card. It must say only
   "CAPS POKER / caps.ftable.co.il".
3. Check the caption against the banned list (§5) word by word.
4. Compose from the Page's "What's on your mind" box → add video. A 9:16 clip under 30 s is
   auto-classified as a Reel; that is fine and not a setting to fight.
5. Facebook runs a "Checking for copyrighted content" scan before **Next** enables. Wait for it.
6. Publish. Verify per §7, and **watch the published video play**, not just its thumbnail.

The caption of record for the explainer:

```
CAPS Poker — poker played across several boards at once.
Four cards on every board. Win the most boards, win the hand.

Free to play in your browser. No sign-up.
caps.ftable.co.il
```

## 5. Hard stops

- **Never type or request the account password.** Facebook's Name Change Request demands it; that
  is why the Page is still `Capspokerapp`. The rename is Roye's to do by hand. Once changed the
  name is locked for **60 days** and review takes up to 3 days.
- **No security or account settings.** Two-factor, recovery, admin roles, login alerts: not ours.
- **Banned in any public text**: App Store, Google Play, "download", "coming soon", player counts,
  ratings, any real-money language. The app is not submitted and the listing is blank; nothing on
  the Page may imply otherwise. (Project rule: never suggest App Store submission unless Roye
  says so.)
- **No Instagram, no TikTok** until a `capspokerapp` session exists. Do not post from
  `featuretable1`.
- **Nothing scheduled, nothing boosted, no ads.** The Advertise buttons are everywhere; ignore
  them.
- **One change per instruction.** "Only this, then stop" means exactly that.

## 6. Bio of record

```
Multi-board poker. Play free in your browser.

Poker played across several boards at once. Four cards on every board — win the most boards, win the hand.

Free · no sign-up
caps.ftable.co.il
```

`no download ·` was removed on 2026-09-09 on instruction. Do not reintroduce it.

## 7. Verification (every change)

1. **Hard reload** the Page after saving; screenshots of the pre-save state prove nothing.
2. **Admin view**: logged in as the Page — the new value is there.
3. **Visitor view**: switch to the personal account (Roye Arguan), which is not acting as the
   Page, and open the Page URL. It shows Follow / Message and the public fields exactly as a
   visitor would. A true logged-out check needs a second browser identity, which the automation
   does not have; say so in the report rather than claiming it.
4. **Timestamp the change**: open the photo or post and read Facebook's own "x minutes ago" /
   "updated their cover photo" line. That line is what proves a change happened, and what proves
   it *already* happened when you are about to duplicate it.
5. Save the two screenshots beside the session's README under `docs/<what>-<date>/`.
6. Update §2 of this runbook in the same commit.

## 8. Session log

| Date | What | Record |
|---|---|---|
| 2026-09-06 | Social image set generated (profiles ×4, covers ×2), nothing uploaded | `docs/social/SPLASH-ASSETS-EXPLAINERS-2026-09-06.md` §2 |
| 2026-09-09 | Profile picture set to the app icon; bio trimmed; rename blocked at the password prompt | `docs/facebook-update-2026-09-09/README.md` |
| 2026-09-09 | First post: the explainer video, verified by bytes and by playback | `docs/facebook-first-post-2026-09-09/README.md` |
| 2026-09-09 | Cover art generated at 851×315 with overlay proof | commit `61ec8742` |
| 2026-09-09 | Cover photo UPLOADED by Claude Code (`facebook-cover-851x315.png`), then that session crashed before it could report or write this log | the Page's own "updated their cover photo" post; no session README exists for the upload |
| 2026-09-09 | Follow-up session, asked to upload the same cover, found it already LIVE (~10 min old) and made no second upload, to avoid a duplicate post | this file, and the struck-through cover line in `docs/facebook-update-2026-09-09/README.md` |
