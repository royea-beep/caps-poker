# VAMOS CAPS AUDIT-REST-AND-EXPLAINERS — 2026-09-05

Branch `claude/vamos-caps-align-celebration-flppo0`. Nothing published, nobody invited, no flag,
economy or security change. `tsc` clean, **2,714 / 2,714** tests green.

---

## MAP — carried forward, with one correction that is mine

Carried: the blind spot is named — no check in this project saw text baked into an image; the
English landing page is fixed and live; 518 devices · 25 played · 7 bindings · 2 redemptions ·
gap 0 · purchases 0.

⚠️ **One line of the MAP is not what happened, and the difference matters because the proposed
guard is aimed at the wrong defect.**

> *"the page was fine; the capture tool ignored the language parameter, produced one image twice,
> and saved it under two names."*

Two separate real findings have been merged into one sentence:

1. **The live bug was the PAGE, not the capture tool.** The deployed `landing.html` had **no image
   swap at all** — two plain `<img src>` tags, `img data-l` zero times — pointing at two
   un-suffixed filenames that held the Hebrew screenshots. There was no EN/HE pair to confuse.
2. **The capture tool DID write one image twice** — but it was `game-reveal-en/he.webp`, each a
   duplicate of its own *boards* shot, because a `/READY/` text locator matched the status pill
   instead of the button. That is the "one image under two names" defect, and it is a different
   file pair from the one that was live.

**Consequence for the guard.** A byte-difference check between an EN and an HE shot would **not**
have caught the live bug: the live page had one image per figure, so there was no pair to compare.
It *would* have caught the duplicate reveal. It is worth having, and it is now enforced — but it
is not sufficient, and this sprint proved that too: the lobby's EN and HE stills **differ in bytes
(281,185 vs 280,973) while both contain zero Hebrew.** The difference is an animated spinner. A
byte guard passes that; the DOM-script check is what actually knows. Both now run, and the byte
check alone is never treated as proof.

---

## §1 — THE REMAINING AUDIT FINDINGS

`docs/total-audit/TOTAL-AUDIT-2026-09-02.md` worked through in full, not from memory.

### FIXED

**C1 — two sources of truth on the hand outcome. CLOSED.**
The audit's one "trivial, safe fix available", still open in the current build:
`app/hand-history.tsx:126` and `app/replay.tsx:110` decided win/loss/tie from the **collapsed**
board count while `results.tsx`, `statsEngine`, `shareHand` and `achievements` all read
`deriveHandOutcome()`. One stored hand, two answers. The reachable divergence is three players /
three boards / one board each: the server and every other reader call it a **TIE**, those two
screens called it a **LOSS** and filed the hand under "Losses" with a red border.

Both now read the one derivation. **The printed numbers are unchanged** — they are the collapsed
scoreboard the app has always shown; only the verdict moved. **Old rows are unaffected**:
`deriveHandOutcome` falls back to that same count when `winnerSeat` is absent, and the fallback is
provably identical everywhere except the 3P shape.

Guarded by `utils/__tests__/one-outcome-derivation.test.ts` (8 assertions). ⚠️ Its first version
failed on its own fix: the new comment *quotes* the expression it replaced, and a raw text match
found the defect inside the note explaining the defect is gone. The guard strips comments now — a
source guard that cannot tell code from prose reports the wrong thing.

**A hardcoded board rule in the lobby. FIXED.**
`app/lobby/index.tsx` restated the board counts as literals (`4 / 3 / 2`) — a second source of
truth for the rule CLAUDE.md makes a hard rule. The values were right, which is exactly why it was
worth changing: this is the screen that *tells* a player what a table will deal them. It reads
`getBoardCount()` now; the rendered output is identical and both halves are pinned by test.

### CONFIRMED CORRECT — no change needed

**FIVE-O copy.** Already corrected on 2026-09-03 and verified here against the source: preview
background `#1A1A2E` (navy), tag "Modern", description **"Navy table / Mint accents"** (EN) and
**"שולחן כחול כהה / הדגשים במנטה"** (HE). No `#5c0000` and no "Red felt" survive in any shipped
string. Two *documentation* leftovers did survive and one is corrected here:
`docs/CAPS-MASTER-KNOWLEDGE-v2.md` said "Board.tsx | Red felt". `prompts/**` still carries two
similar lines and is outside this sprint's edit scope.

**E4 dead code.** `components/DealMeInButton.tsx` is already gone. `utils/webPayments.ts` and
`hooks/useSimpleReveal.ts` remain with **zero references anywhere** — but `hooks/` and `utils/`
are outside this sprint's edit scope, so both are report-only. `computeOmahaEquity` has no runtime
caller but its tests do call it, so removing the export would break the suite; leave it.

### REPORTED, WITH FRESH EVIDENCE

| finding | state today |
|---|---|
| **S3** `referral_links` world-readable | **STILL OPEN.** Policy "Anyone can read referral links" is live, `anon` still has SELECT, **2,014 rows** readable. A DB policy change and a security change — both outside this sprint's scope |
| **E1** DB cannot be rebuilt from the repo | Unchanged. Explicitly the payments sprint's problem, not this one |
| **E2** single 3.62 MB bundle | Unchanged, report-only |
| **E3** `Board` not memoized | Unchanged, report-only; watch on device |
| **E5** dead / superseded DB surface | **All seven still present**: `learning_events`, `player_cups`, `qa_reports`, `chip_transactions_prereset_20260901`, `_backup_starter_redemptions_20260816`, `_econ_fn_backup`, `_tmp_commit_blobs`. `purchases` and `chip_purchases` are **both 0 rows** — confirm they are not a schema duplication before payments |
| **C2 / C3** latent tie / dimension traps | Unchanged, off the live path |
| **V2** "Tie" over a "1 — 2" score | Still visible, still **by design** and documented in `utils/boardTally.ts`: the headline uses the best *single* opponent (the server's rule), the numerals print the collapsed opponents-combined figure. Recorded again so nobody re-derives it as a bug |
| **V3** winner-gold on secondary CTAs | Measured last sprint across 40 screen/width/engine combinations: the winner cue `#FFD700` appears on **0** controls. Closed |

### NEW — found while capturing the explainers

**Two definitions of "a hand you played", one tap apart.** After one practice hand this run:
Profile reads **1 HANDS**; Hand History reads **All (0) · No hands yet**. Both are working as
written — `app/results.tsx:435` saves to history only `if (!isPracticeGame)`, while
`app/(tabs)/profile.tsx:13` reads `handsPlayed` from the store, which counts practice. Same family
as C1. Reported, not fixed: which one is right is a product decision.

**`hand_history.boards_data` is NULL in all 76 production rows** — see the tie item below.

---

## §1.1 — THE TIE IN OLD ROWS

**The decision not to backfill holds, and now for a stronger reason than "we chose not to".**

`hand_history` production, measured today: **76 rows — 58 won / 14 lost / 4 tied.** Every `tied`
row is dated 2026-08-28 or later, i.e. after the fix. **New rows are correct**: the writer sends
`p_won = null` on a tie (`utils/handOutbox.ts:113`) from `handOutcome`, the one derivation
(`app/results.tsx:707`).

⚠️ **The old rows cannot be adjudicated at all, so a backfill is not merely unwise — it is not
possible.** `boards_data` is NULL in **all 76 rows**, and `app/results.tsx:448` already records why
(the column never once received an insert and was dropped). `boards_won` is present on only 25.
Production holds no per-board detail for any historical hand.

⚠️ **And a figure that was in the code has been removed rather than repeated.** The comment in
`app/hand-history.tsx` claimed "of the 22 genuinely board-tied hands, 15 are stored 'lost' and 5
'won'". That is **not reproducible against production** — the table cannot yield it. Whatever it
counted, it was not this table. The comment now says so.

What *is* measurable: 4 rows sit at an even split (2-of-4 at 2P, 1-of-2 at 4P) yet are stored
`lost` or `won`, and 4 more are `lost` at 1-of-3 with 3 players — the exact C1 shape. Candidates,
not proof, because a board that itself tied would change each reading and that detail is gone.

**No rows were written, altered or deleted.**

---

## §1.2 — HEBREW IN ENGLISH SCREENS

`tests/i18n-loop.mjs` against a fresh export: **26 routes × 4 widths (320/375/393/430) ×
2 engines × 2 languages**, canary first.

```
chromium CANARY   PASS hebrew_caught   PASS latin_caught   PASS hidden_not_counted
webkit   CANARY   PASS hebrew_caught   PASS latin_caught   PASS hidden_not_counted
HEBREW RENDERED ON ENGLISH SCREENS: 0   (must be 0)
```

**Before → after: 0 → 0.** The zero-tolerance direction was already clean and is now measured
again on this build. Nothing was translated, per the brief.

The other direction, which the rule permits, by route (English still showing on a Hebrew screen):
battle-pass 34 · referral 17 · lobby 13 · lobby/private 12 · achievements 11 · orientation-pick 10
· leaderboard 8 · friends 7 · stats / rank / hand-history / coaching / gameover 5 · shop /
chip-store / replay 4 · spectate 3 · settings 1.

The explainer language guard adds a sharper reading of two of them: **the Chip Shop and the Lobby
render zero Hebrew characters** — they are not partly translated, they are untranslated.

---

## §2 — AN EXPLAINER PER SCREEN

Eight clips in `docs/explainers/`, 1080×1920, **no audio stream at all**, first caption at t=0,
every one under 30 seconds.

| clip | seconds | what it shows |
|---|---|---|
| `01-home.mp4` | 11.0 | Play Online / Practice vs bots, the format line, the daily bonus |
| `02-placement.mp4` | 11.5 | cards in hand, Auto-Place, Confirm, READY |
| `03-reveal.mp4` | 8.5 | boards revealing, live odds, each board named and settled |
| `04-results.mp4` | 10.0 | the outcome, the boards-won score, Hand details, Deal me in |
| `05-hand-history.mp4` | 10.5 | the list and its filters — empty, honestly |
| `06-profile.mp4` | 13.5 | hands, win rate, streak, chips, and the five rows below |
| `07-lobby.mp4` | 6.8 | heads-up / 3-player / 4-player and the board count per table |
| `08-shop.mp4` | 6.5 | the chip shop, empty |

### Screenshots verified English — the guard was used, and it changed the run

Before a single frame was recorded, each of six screens was captured in **both** languages and
checked three ways: bytes differ, EN has zero Hebrew, HE has some. Results:

| screen | EN/HE bytes differ | EN Hebrew chars | HE Hebrew chars |
|---|---|---|---|
| home | yes | 0 | 222 |
| play | yes | 0 | 205 |
| profile | yes | 0 | 94 |
| history | yes | 0 | 17 |
| shop | yes | 0 | **0** |
| lobby | yes | 0 | **0** |

⚠️ **The guard's first version aborted the whole run**, because it treated "HE contains no Hebrew"
as a failure. Under the rule that is *acceptable* — English must never show Hebrew, the other way
round is fine. A guard encoding an expectation the product does not owe is the guard being wrong.
Only the zero-tolerance direction aborts now; an untranslated screen is reported.

### Every caption checked against production

| caption claim | checked against |
|---|---|
| "Play Online, or practise against bots" | both controls on the captured home frame |
| "A daily bonus tops up your chips" | "Claim daily bonus · Day 1" on the same frame |
| "Four cards per board. You choose where" | "PLACE 12 CARDS" over 3 boards on the placement frame |
| "Auto-Place fills a board fast. Then READY" | the per-board ⚡ chips and the ✓ READY button |
| "Live odds while cards are still to come" | the equity bar reading 94% / 4% / 2% mid-reveal |
| "The score is boards won, not chips" | the "1 — 2" numerals |
| "Practice hands are not recorded" | `app/results.tsx:435` — `if (!isPracticeGame) saveHandToHistory(...)`; and the screen reads "No hands yet" after a practice hand |
| "Fewer players, more boards: 2 play 4" | the lobby's own "2 players · 4 boards", and `getBoardCount()` |
| "Empty today. Nothing is for sale" | "Shop is empty right now." on the frame |

**No number is quoted in any caption.** The achievements figure that was wrong last time is not
repeated, correctly or otherwise — the profile clip names the row and shows it.

### Watched every clip — and three things were wrong

Automated checks passed on all eight. Looking did not.

1. **`04-results` ran two seconds past the screen.** Its last frames were the CAPS splash, under
   the caption "Deal me in starts the next hand". Window shortened 12.5s → 10.0s.
2. **`07-lobby` ended on the SHOP.** Caption "Fewer players, more boards" over the chip shop.
   Shortened 14.0s → 8.0s → **6.8s**, because 8.0s still caught the transition.
3. **Three captions ran off the 1080px frame** and rendered as legible nonsense —
   *"ty today. Nothing is for sale and nothing is requ"*. Rewritten, and the cut tool now
   **throws** above 54 characters rather than truncating silently.

The final frame of all eight was then checked again: every clip ends on the screen it describes.
Evidence committed in `docs/explainers/verification/`.

### Multiplayer was not filmed

**Confirmed, and stated rather than staged.** No room has ever finished a hand through the lobby,
so there is nothing to capture; a filmed "multiplayer game" would be a claim the product cannot
back. The lobby clip shows the lobby as it is. Its table rows read *"Opening a table…"* because the
capture runs with the network blocked, so the clip shows the lobby's **shape** — the three table
sizes and their board counts — which is exactly what its captions say.

---

## §3 — THE HONEST BOUNDARY

What these clips **cannot** show, and must not be published as showing:

1. **Native rendering.** Every frame is the web build in Chromium at 486×864 upscaled to 1080.
   The five device-only questions stand: the fallback serif masthead, flat gold instead of the
   gradient, the icon at 60px, the felt and beam on an OLED, and the multiplayer label at the
   largest Dynamic Type.
2. **Real multiplayer.** Not filmed, because it has never happened.
3. **Anything behind a flag.** Payments are off, so the shop is genuinely empty; the battle pass
   and missions are not shown. Nothing here implies a purchase exists.
4. **Live lobby tables.** The rows are placeholders, not real tables with real people.
5. **The economy in motion.** The hand filmed is practice — "XP only, no chips" is on screen — so
   no clip shows chips being won or lost.

**Nothing was published.** The clips are committed, not uploaded.

---

## git show

```
git show HEAD -- docs/explainers/                      # the eight clips + clips.json
git show HEAD -- docs/explainers/verification/         # what watching them found
git show HEAD -- docs/audit-rest-2026-09-05/           # this report + the loop artefact
git show HEAD -- app/hand-history.tsx app/replay.tsx   # C1 closed
git show HEAD -- app/lobby/index.tsx                   # the board rule read, not restated
git show HEAD -- utils/__tests__/one-outcome-derivation.test.ts
git show HEAD -- tools/explainers.mjs tools/explainer-cut.mjs
```

## Production unchanged

No economy change, no flag change, no security change, no `verify_jwt` change, no migration
repair, no winner cue, no card size, no 83px arc, no tie-tally arithmetic, no `KILL_Board`. No
rows written, altered or deleted. `components/Card.tsx` untouched.
