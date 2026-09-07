# VAMOS CAPS — BAILEY-AND-REFRESH (2026-09-03)

Open BAILEY · re-run the rig against the current build · correct the English-first assumption.
Branch `claude/vamos-caps-align-celebration-flppo0` @ `028c5c7`. Not merged, no bump.
No app code, economy, flag or security fix touched.

---

## 1 — BAILEY: could not be opened from this session

`C:\Projects\CONTENT-AI\bailey` is a **Windows path on Roye's own machine**. This session runs in a
**remote Linux container** that cloned only `royea-beep/caps-poker`. Three checks, all negative:

| check | result |
|---|---|
| `find /` for `*bailey*` and `*CONTENT-AI*` | **no match anywhere** |
| Windows mounts / drives (`/mnt/c`, `/c`, `/media`, `/Volumes`) | **none exist**; `/mnt/attach` is empty |
| filesystems present | container root, `/opt/claude-code`, `/opt/env-runner` only |

Also negative last sprint: no repo named BAILEY among the account's 34, and zero references in
CAPS's written record (only "Baileys", an unrelated WhatsApp library).

**Nothing about BAILEY's contents is reported here, because I have not seen them.** The character
question — does a CAPS character or voice exist — remains **open and unanswered**.

**To get it to me, any one of these works:**
1. `cd C:\Projects\CONTENT-AI\bailey && git init && git add -A && git commit -m init` then push to a
   private GitHub repo under `royea-beep`. Name it and I will attach and inventory it in full.
2. Zip it and attach it to a session.
3. Copy the CAPS subfolder into `C:\Projects\POKER\Caps\bailey-import\` and push — it arrives with
   the repo. (Delete it after; it should not live in the app repo.)

Option 1 is best: it is read-only from my side and keeps BAILEY's own history.

---

## 2 — THE TEN VIDEOS: REGENERATED from the current build

`../caps-content/out/*.mp4` — all ten re-cut **2026-09-03** from a fresh `expo export` of the
current app. Same rig, **same seeds**, so the hands are the same and only the app differs.

**Seeds reused, unchanged and verified in `tools/capture.mjs`:** `felt`/`autoplace`/`reveal` = seed
3 · **`win` = seed 8** · **`tie` = seed 5**. The rig pins `Math.random`, so a seed is a reproducible
hand.

| id | kind | secs | new size | source seed |
|---|---|---|---|---|
| play-autoplace | gameplay | 9 | 759 KB | 3 |
| play-reveal | gameplay | 17 | 3124 KB | 3 |
| play-win | gameplay | 17 | 2545 KB | 8 |
| play-tie | gameplay | 17 | 2877 KB | 5 |
| play-felt | gameplay | 9 | 710 KB | 3 |
| dev-signin | devlog | 20 | 2951 KB | 8 |
| dev-invite | devlog | 20 | 3194 KB | 5 |
| dev-achievements | devlog | 18 | 2824 KB | 3 |
| dev-wcag | devlog | 18 | 2888 KB | 8 |
| dev-tie | devlog | 18 | 3132 KB | 5 |

All 1080×1920, 25 fps, **no audio stream**. Videos stay OUT of git by the rig's own design (large,
binary, regenerable); the **posters and the queue are committed** to `docs/product-map/posters/`.

### One rig fix was needed (tools/, in scope)
`play-felt` failed the cut's own length assertion: it needs `actionStart(2s) + 9s = 11.00s` of the
felt take, and the 6s hold produced a **10.84s** take — 0.16s short. I widened the felt scene's hold
to 9s in `tools/capture.mjs` (with the reason in a comment); the take is now 13.7s / 12.08s usable.
**The assertion caught this — it was not silently truncated.** That is the rig working as designed.

### OUTCOMES VERIFIED IN THE APP'S OWN WORDS, before cutting
The old `readOutcome` returns `boards -/-` now because the results IA no longer prints "Boards: x/y".
So I read the results screen directly rather than trusting the manifest:

| scene | seed | headline the app shows | score | verdict |
|---|---|---|---|---|
| win | 8 | **PERFECT** — "COMPLETE! You won ALL boards! COMPLETE bonus" | **4 — 0** | a real sweep ✓ |
| tie | 5 | **TIE GAME** | **2 — 2** | a real tie ✓ |
| reveal | 3 | YOU WIN | 3 — 1 | four boards resolving ✓ |

⚠️ Note for captions: the sweep headline is now **PERFECT**, not "YOU WIN" — the results IA changed.

### RE-WATCHED, every one — two contact sheets, hook frame + payoff frame
- **Hooks (t=0.25s, inside the 0.5s hook deadline):** all ten open on a real, populated app screen.
  **No spinner, no blank, no loading state on any of the ten.**
- **Payoffs:** every clip ends on the thing its caption promises. `play-win` ends on
  **PERFECT / 4—0 / COMPLETE! ALL BOARDS! / Round Complete +50% BONUS**. `play-tie` ends on
  **TIE GAME / 2—2**. `play-autoplace` ends on all boards filled + "ALL CARDS PLACED!".
  **No outcome is mislabelled.** (Last time a "tie" clip ran over a screen reading YOU WIN; that
  class of error is specifically absent here — I checked the two most dangerous ones twice, once
  from the results text and once from the frame.)
- The 4 "page errors" per scene are all `NotAllowedError: play() failed because the user didn't
  interact with the document first` — the headless autoplay policy blocking sound effects. **Not an
  app defect**, and there is no audio stream in the output anyway.

### DEVLOG CAPTIONS — re-verified against the CURRENT app. Two do not hold.

| id | claim | verdict |
|---|---|---|
| `dev-signin` | "The check was 'is there a user'. Anonymous players are users." | ✅ **TRUE, and the fix is live.** `components/SideMenu.tsx` now gates on `(!user \|\| user?.is_anonymous)`, so anonymous players see **Sign in**. The file's own comment tells the same story. |
| `dev-tie` | "When a hand tied, we told both players they lost." | ✅ **TRUE, fix live and on screen.** `utils/handOutcome.ts` carries `'tie'` as its own value; the regenerated clip shows **TIE GAME 2—2**. |
| `dev-wcag` | "Our accessibility test … was running on a screen dimmed to 60%." | ✅ **TRUE as history.** Corroborated independently: `tools/content-lib.mjs` still seeds `caps_games_played=25` precisely to suppress the first-hand coaching tips, which it documents as dimming "the WHOLE screen to ~0.6". The dimming behaviour still exists for first-hand players. |
| `dev-achievements` | "could only ever say **0 of 36**" | ⚠️ **NUMBER IS STALE.** The catalogue in `utils/achievements.ts` holds **12** achievements today, not 36. The story is historically true; the denominator a viewer would see is not. **Re-cut the caption or drop the number.** |
| `dev-invite` | "The database made 8 characters. Every screen accepted 6." + an on-screen **"Fixed."** | ⚠️ **OVERCLAIMS — THE BUG IS STILL PARTLY LIVE.** See below. |

#### ⚠️ dev-invite — a real, still-open defect found by verifying the caption
The validators were widened (`REFERRAL_CODE_MIN = 6`, `REFERRAL_CODE_MAX = 12` in
`constants/appLinks.ts`) and the input carries `maxLength={REFERRAL_CODE_MAX}`. **But
`app/referral.tsx:249` still hard-truncates the typed code:**
```js
onChangeText={v => setRedeemInput(v.toUpperCase().slice(0, 6))}   // placeholder is still "XXXXXX"
```
Measured against the database: `referral_links` holds **2,008 codes, every single one 8 characters**
(last issued 2026-09-02), and **`sum(conversions) = 0`** — still zero redemptions in the history of
the product. So a player typing a real 8-character code has it silently cut to 6, which then
*passes* `isPlausibleReferralCode` (6 ≥ MIN), and a wrong code is sent to the server. The deep-link
path (`/invite/[code]`) normalises without the truncation and is unaffected — **manual entry is the
broken half.**
**Not fixed here: app code is out of scope this session.** Flagged for a client sprint. Until then
the `dev-invite` video's "Fixed." card should not ship.

---

## 3 — STILLS FROM THE SAME RUN

| set | path | size | contents |
|---|---|---|---|
| Landing heroes | `docs/product-map/heroes/` | **660×1431** | `game-boards` (3P, boards filled — the multiboard differentiator) · `game-reveal` (live odds/outs) — the exact size `public/landing.html` already uses |
| App Store set | `docs/product-map/store/` | **1290×2796** (iPhone 6.7") | 01-home · 02-play · 03-shop · 04-achievements · 05-game-placement · 06-game-reveal · 07-results |
| Every screen | `docs/product-map/shots/{en,he}/` | 393×852 @2x | 44 shots (22 EN + 22 HE), committed last sprint from the identical app bundle |
| Video posters | `docs/product-map/posters/` | 1080×1920 | all ten, regenerated 2026-09-03, + `queue.json` |

**Language of the assets: ENGLISH.** Videos, heroes and the store set are English only — CAPS is a
global, English-first app and these are global assets. Hebrew was **not** produced for them; the
Hebrew screen set from last sprint remains available for the Israeli pilot if it is ever wanted.

**Practice-only + offline guard held throughout.** Every context aborted `supabase.co` and
`ftable.co.il`; `openGame()` refuses any non-practice route by construction; a local export was
filmed, never production. **No production write, no device minted, no ledger movement.**

---

## 4 — THE RECORD CORRECTED: CAPS IS ENGLISH-FIRST

**Roye's correction, recorded so no future session re-derives the opposite:** CAPS is a GLOBAL app.
**English is the default and primary language.** Hebrew exists for the Israeli pilot, and even that
pilot will include players from anywhere. Hebrew is an addition, never the requirement.

**The previous framing was wrong and is retracted.** Last sprint's inventory listed "ten screens are
still 100% English" as a gap and ranked "finish the Hebrew" near the top. **A screen rendering
English is the correct state, not a defect.**

**The real defect is the half-state, and it is about consistency:** the app *offers* Hebrew and then
delivers English on most screens, and leaks English into the screens it did translate — the home
daily-bonus chip and the legal line are live, visible examples. Either a screen is translated, or
the app should not claim that language for it.

Corrected in three places:
1. **`CLAUDE.md`** — the stale "5 tabs" line (**3 tabs** since `eaf9201`, 2026-08-31, with Friends
   and Cups as `href: null` routes); a new **LADDER** entry (server-authoritative since CLOSE-S2,
   solo no longer climbs, do not "fix" it back); and a new **LANGUAGE** entry stating English-first
   with the retraction spelled out.
2. **`docs/product-map/INVENTORY-AND-MAP-2026-09-03.md` §4d** — retitled from "Hebrew coverage" to
   "Language — ENGLISH-FIRST", with the retraction, and the measurement kept as evidence rather
   than as a target.
3. Same doc, **MISSING list and the ranked list** — "wire 10 screens to `t()`" replaced by "resolve
   the language half-state; do NOT mass-translate".

---

## 5 — VERIFY IT YOURSELF

```bash
git show --stat HEAD                                  # this sprint
git show HEAD -- CLAUDE.md                            # tabs / ladder / language corrections
git log --oneline -3 -- docs/product-map/             # map, shots, posters, heroes, store
ls -la docs/product-map/{heroes,store,posters}/       # the new stills + posters
node -e "console.log(require('./docs/product-map/posters/queue.json').videos.map(v=>v.id+' '+v.seconds+'s').join('\n'))"
ffprobe -v error -show_entries format=duration -of csv=p=0 ../caps-content/out/play-win.mp4
```

Re-run the whole thing:
```bash
npx expo export --platform web --output-dir /tmp/webexport
export CAPS_BROWSER_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
DIST=/tmp/webexport node tools/capture.mjs && node tools/find-action.mjs && node tools/cut.mjs
node tools/contact-sheet.mjs
```

---

## 6 — WHAT WAS AND WAS NOT DONE
**Built:** ten regenerated videos (outside git by design), ten posters, two landing heroes, a
seven-shot App Store set, and the record corrections. **One rig fix** (`tools/capture.mjs` felt hold
6s → 9s) with the reason recorded.
**NOT done, deliberately:** no landing page (waiting on Roye seeing these), BAILEY untouched and
unread, no multiplayer footage (0 rooms have ever finished — there is nothing to film), no
translation of anything, no app code / economy / flag / security change, no merge, no version bump.
**Production unchanged.**
