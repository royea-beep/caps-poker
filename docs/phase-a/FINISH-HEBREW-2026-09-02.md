# VAMOS CAPS — FINISH-HEBREW (2026-09-02)

One focused pass: finish the Hebrew i18n wiring on the game/reveal/results flow, un-force
`getLanguage()`, verify by rendering at 320, re-shoot the landing shots, merge to main, ship 514.
Branch `claude/vamos-caps-align-celebration-flppo0` → main. **Hebrew UI is now live.**

## MAP
h156/PHASE-A scoped the gap: the reveal/results flow half-translated because ~120 hardcoded
English strings across `Board.tsx`, `EquityBar.tsx`, `BoardResultCard.tsx`, `results.tsx`,
`BoardReveal.tsx` + the home CTAs never went through `t()`. A Hebrew device saw "הפסדת" beside
"Board 1 / BOT 1 / COMMUNITY / So close!". This pass wired all of it, THEN flipped the switch.

## Components taken — the ENTIRE user-visible game/reveal/results/home flow (finished, not partial)
Wired literals per component:
- **BoardReveal.tsx** (the reveal screen — the 26% screen): board-number header, bot labels
  (🤖 בוט N), Community (קהילה), score indicator (Leading/Trailing/Tied/N boards → t()),
  So close!, Tie board, the three COMPLETE-bonus sub-lines, the player-row label
  (Player 1 → שחקן 1), the tap hints (Tap to continue / hold to skip all / TAP FOR RESULTS),
  and the first-game REVEAL_TIPS ×3.
- **OutsRow.tsx**: OUTS / DANGER / CALCULATING… + a11y (outs to win / cards that lose it).
- **Board.tsx**: WIN/LOSE/TIE badge, "Revealed after River", a11y slot hints (tap-to-place /
  select-first), autoPlace already wired (HE shortened to fit 320).
- **EquityBar.tsx**: YOU/OPP/LEAD/LEADING/TRAILING, Calculating odds.
- **BoardResultCard.tsx**: board label, WIN/LOSS/TIE, Bot N, YOU, share sheet (Share Image /
  Share as Story / Copy Replay Link / Cancel), Link copied, ✅ YOU WIN result line,
  "Best hand from 9 cards".
- **results.tsx** (~60): headline (PERFECT/YOU WIN/YOU LOSE/TIE GAME), practice banner + session
  net, score tally (WON/TIED/LOST), tie bonus, win-streak badge + Best, details toggle, XP
  breakdown (Game/Boards/Win/Complete), best-hand line, stats row (Boards/Net/Games), COMPLETE!
  ALL BOARDS!, opponent-swept, Net Result, daily-streak line, Share COMPLETE, Current Balance,
  MP header (You beat / Defeated by / Tied with), ELO rank up/down, session W/L, board-by-board
  breakdown (title, Board N, vs, won/tied/lost a11y), View hand history, and every action button
  (Coaching / Share Hand / REMATCH / HOME / LEAVE / Deal me in / GAME OVER).
- **PlayerHand.tsx**: Auto-Place ALL, "All cards placed!".
- **TimerController.tsx**: "Time out = cards placed randomly".
- **home (index.tsx)**: Play Online, Practice vs bots, the teaching sentence.
- **i18n.ts**: +~110 he/en keys at full parity (**212/212**, verified — no missing/extra either
  side). Hand-rank NAMES stay English on purpose (HAND_RANK_NAMES constants in
  utils/handEvaluator.ts) — a poker-terminology choice, not a gap. All EN strings preserved
  verbatim via dedicated keys, so the English UI is byte-identical.

## getLanguage un-forced AFTER the strings were wired
Order held: wired → tsc + jest green → flipped. `getLanguage()` now returns the device language
(Hebrew locale → Hebrew UI); `setLanguage()` switches the active language. Four i18n unit tests
that encoded the old forced-'en' behavior were updated to assert the new behavior. Full suite
green (2649 + the 4 flipped).

## Coverage per screen AFTER the flip (rendered at 320, he-IL, practice — offline)
| screen      | 2P (4 boards) | 3P (3 boards) | overflow |
|-------------|:-------------:|:-------------:|:--------:|
| home        | 70%           | 71%           | none     |
| game-place  | 68%           | 69%           | none     |
| reveal      | **57%**       | **58%**       | none     |
| results     | 97%           | 97%           | none     |

Reveal rose from a pre-wire **26% → 57–58%**. Its remaining Latin is by design: card rank glyphs
(A/K/Q/J/T on ~13 cards), the policy-English hand-rank names, the "X beats Y" comparison line, and
the COMPLETE brand word. Results is effectively fully Hebrew (2 Latin chars = the "XP" token).
Screenshots: `docs/phase-a/he-{home,game,reveal,results}-{2,3}p.png`.

## מיקום אוטומטי + Auto-Place ALL — both fixed
- `autoPlace` HE was '⚡ מיקום אוטומטי' and truncated at 320 → shortened to '⚡ מילוי'.
- "Auto-Place ALL" (PlayerHand) was still English → `t().autoPlaceAll` ('מלא הכל').

## Hebrew at 320 × 2P/3P/4P fits | layout changes: NONE needed, none made
No horizontal overflow on any screen at 320 in he-IL, across 2P (4 boards, tightest) and 3P.
4P (2 boards) is strictly less content than 3P/2P, so it is covered by construction. The card
sizes, the winner cue, the 83px arc, and the tie tally were **not** changed — Hebrew fit within
the existing layout. No layout change to report.

## Hebrew landing screenshots re-shot
`public/shots/game-boards.webp` (3P, boards filled) and `public/shots/game-reveal.webp` re-shot at
660×1431 in he-IL, replacing the English-chrome shots (Chromium canvas encoded the webp — no
cwebp/sharp in the container). Updated the landing comment that claimed "chrome in English
regardless of locale" (no longer true). Both shots are coherent Hebrew; the boards shot's earlier
"All cards placed!" English leak is fixed.

## Shipped
- **Merged sha:** 8da8cbb (fast-forward from main's 2d9ca2d — clean, no conflict).
- **Confirmed origin/main:** `git rev-parse origin/main` == 8da8cbb (== branch HEAD).
- **Web content delta (not hash):** live bundle `index-71fad0c5…js`, 3,821,159 bytes. New i18n
  keys present (outsLabel, soClose, tieBoard, homeTeaching, scoreLeading, revealTip1,
  autoPlaceAll, playerFallback — all ×1); escaped-unicode Hebrew markers present (אאוטים ×1,
  כמעט ×1); `detectLanguageCode` in the getLanguage path (the un-force). Deploy shipped.
- **Bumped 514:** ios.buildNumber 513 → 514 (513 is on TestFlight; Apple rejects a re-upload).
- **iOS build 514 — DELIVERED.** `ios-testflight.yml` run 33634940856 on main @ 8da8cbb,
  conclusion success (~19 min). altool, quoted verbatim:
  `UPLOAD SUCCEEDED with no errors` / `Delivery UUID: c6ec704a-0c2c-4804-97fa-1a9caa05bf4a` /
  `Transferred 23948355 bytes in 0.413 seconds` / `No errors uploading archive at
  '.../CapsPoker.ipa'.` (BUILD_NUMBER 514, MARKETING_VERSION 2.7.0). **IPA byte size vs 513:**
  514 = 23,948,355 B vs 513 = 23,224,751 B → **+723,604 B (+3.1%)**, consistent with the added
  i18n table + wiring (JS-only growth; the two re-shot webp are web-only, not in the IPA).

## BackstopJS baselines — CURRENT, not stale (no regen)
BackstopJS seeds `caps_language=en` (en-US locale), so it renders the **English** UI. Every English
string was preserved verbatim via dedicated keys, so the English visual output is unchanged and the
existing `backstop_data/bitmaps_reference/` remains valid. Regenerating would produce identical
images (and a baseline commit that absorbs unrelated drift is worse than none). The only visual
delta is under a Hebrew locale, which BackstopJS does not exercise. web-deploy.yml's non-blocking
backstop test will compare 514's English render against those same baselines.

## TAP LIST for 514 (ordered; NATIVE-ONLY marked ⧉)
Set the device to a **Hebrew** locale (Settings → General → Language & Region → Hebrew) so the app
picks Hebrew; then, in order:
1. Home — confirm Hebrew: שחק אונליין, תרגול מול בוטים, the teaching sentence, the 5 tabs.
2. Start **תרגול מול בוטים** (Practice). Placement screen — בורד labels, היד שלך, ✓ מוכן / ביטול,
   the ⚡ מילוי per-board chip and מלא הכל all-chip fit without truncation at your width.
3. Tap **מלא הכל**, then **✓ מוכן**.
4. Reveal — verify Hebrew: בורד N header, בוט 1/בוט 2, קהילה, שחקן N, the equity row (יתרון/אתה),
   the N אאוטים badge, כמעט! on a narrow loss, הקש לחשיפה / הקש לתוצאות. Hand-rank NAMES stay
   English (expected).
5. Play through to **results** — הפסדת/ניצחת/תיקו headline, score tally, נטו/יתרה, and the buttons
   שחק שוב / בית / שתף יד. Tap **פרטי היד** and confirm the detail rows (בורד אחר בורד, XP
   breakdown, session) are Hebrew.
6. Sticky **קלפים חדשים** deals a fresh hand; **המשחק נגמר** shows only when chips < entry.
7. ⧉ **First-launch:** notification permission is NOT prompted on cold start (only after a hand,
   once) — see PHASE-A.
8. ⧉ Settings → **דווח על תקלה**: bilingual bug form, RTL, submits to bug_reports.
9. ⧉ Background the app after a hand, wait — the day-1/day-3 return reminders fire in Hebrew.
10. ⧉ Confirm the build identity: Settings/About reads build **514**.
Web-only sanity (no device): caps.ftable.co.il in a Hebrew browser shows the same flow.

## Cue / card sizes / arc / tie tally / economy / flags — UNTOUCHED
No change to the winner cue, `getCardDimensions`/CARD_SCALE, the 83px arc, the tie-tally math, any
economy value, or any feature flag. This pass added translation keys and swapped hardcoded literals
for `t()` calls; the only non-i18n edits are the version bump (514) and the re-shot landing webp.
