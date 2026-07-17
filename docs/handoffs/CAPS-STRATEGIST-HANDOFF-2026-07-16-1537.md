> ## ⚠ BANNER ADDED 2026-07-17 ON COMMIT — READ BEFORE ACTING ON ANYTHING BELOW
>
> This document is preserved **VERBATIM as written 2026-07-16 15:37**. Its architecture,
> rulings, and lessons are still current. Its *sequencing* is NOT — it predates the
> S76-BOARD batch shipping. Read `CAPS-STATUS-2026-07-17-routing-next.md` FIRST; where
> the two disagree, **the status doc wins**.
>
> **SUPERSEDED — DO NOT ACT ON:**
> - **"NEXT BATCH — S76-BOARD" + "SAFE-STOP VALVE" + "S76-BOARD SEQUENCING"** (the pin
>   batch). It **SHIPPED**: main `b3bf09a` = pin `d6199b6` + FILL11 `8b1c4a4`, OTA group
>   `1f8994a2`, bundle `index-d72ec102`. The line *"READY TO RUN… re-issue it verbatim"*
>   would make a fresh session **RE-RUN shipped work**. It is DONE. The real next batch is
>   **Board ROUTING** — see the status doc.
> - **"SHIPPED & VERIFIED"** is incomplete: it lists S75 + S76 Commit 1a only. Add
>   S76-BOARD pin + FILL11 (19 `board*` keys pinned classic=fiveo=today, +3 reused;
>   all 19 streetStencil values real, 0 TODO; zero routed).
> - **"AFTER BOARD" step 1** says flip the dev build right after S76-BOARD lands. Refined:
>   the flip must come after **routing AND the literals/panel increment**, or the first
>   on-device look is a half-painted mix. See the status doc.
>
> **DEAD POINTERS (verified against the repo 2026-07-17):**
> - `VAMOS-CAPS-S76-BOARD-BEFORE-AUDIT-2026-07-17-0039.md` — **does not exist**. Its
>   findings were re-derived live and are captured in the status doc + project memory.
> - `VAMOS-CAPS-SETTINGS-AUDIT-2026-07-17-0023.md` — **does not exist**. Re-run the
>   read-only settings audit rather than reconstructing it.
> - `VAMOS-CAPS-S76-BOARD-PIN-GO-2026-07-17-0042.md` — NOW exists at
>   `prompts/` (committed alongside this). It did **not** exist when this handoff called it
>   "already written"; it was authored 2026-07-17.
> - **STYLE POOL** PNGs live in the strategist's sandbox (`/mnt/user-data/outputs`), which
>   no bot session can open. Re-attach them if look questions reopen.
>
> **STILL CURRENT, TRUST IT:** GOAL · NEW PRODUCT DECISIONS (4→1 unification, vibration +
> language, settings cleanup, Apple-required items) · ARCHITECTURE (Option 2) · the
> pin-first-vs-unification RULING · RETIRE-LEGACY · LOGGED DEBT incl. GREP DEBT ·
> PRE-EXISTING DIRTY FILES · GATE STATE (`premium_theme_enabled` still ABSENT, verified
> again 2026-07-17) · S77–S80 roadmap.
>
> **Lesson this banner exists to stop:** every dead pointer above was a file confidently
> described as existing. Verify the path before trusting the claim.

# CAPS THEME WORK — STRATEGIST HANDOFF (fresh session) — 2026-07-16 ~15:37 IST
### Paste at top of a new strategist chat to resume. Supersedes the 14:13 handoff.

## GOAL
User-selectable THEME SYSTEM for CAPS. Default (later) = **N8 Street Stencil**; switchable alternates = **V19 Olympus, V22 Volcano Ruby, X9 Marble Noir**. All 4 + switcher into launch, full quality. **IRON RULE: paint only, never layout.** Owner (Roye) emphatic: the current layout works, do not move geometry. Roye writes Hebrew, wants concise English replies, is courier + device eye-tester; never give him to-do lists except device-only actions.

## NEW PRODUCT DECISIONS (Roye, 2026-07-17 — do these, in this order)
1. **ORDER: S76-BOARD FIRST** (paint the game, get Street Stencil visible on a dev build — Roye is frustrated nothing is visible yet; this closes that gap). THEN the settings work below. Strategist decided the order; Roye deferred to it.
2. **UNIFY the 4 look-controls into ONE theme (Roye chose "Option A").** Settings currently has FOUR independent pickers: VisualThemePicker (classic/fiveo), HomeThemePicker (10 home themes), ButtonStylePicker, CardThemePicker (v1/v2/v3). These fight each other and our S77 picker would be a 5th. CONSOLIDATE: one theme choice (streetStencil/olympus/volcano/marble) drives home + buttons + cards + colours together. This DELETES 3 pickers from Settings and is the coherent-identity system Roye originally asked for. (This is why the theme work felt tangled — 4 half-built theming systems already competing.)
3. **BUILD vibration + language into Settings** (both chosen). Neither exists today: haptics has NO user toggle (only internal button feedback); language is ONLY on first-launch, not changeable in Settings, AND code notes warn `caps_language pref currently not applied` — VERIFY language switching actually works before promising it. Sound already exists + works.
4. **SETTINGS CLEANUP**: keep-list = unified theme picker + sound + vibration(new) + language(new) + Apple-required items. Everything else = candidate to remove; strategist presents a cleanup proposal to Roye BEFORE cutting.
5. **Apple-required, do NOT cut, TRACE FIRST**: privacy policy + terms links; **account deletion (Apple REQUIRES in-app deletion)** — bot flagged it's unsure whether "Reset Progress"/"Danger Zone" is progress-reset vs account-deletion. Must trace which row actually deletes the account before touching Danger Zone, or risk removing the only deletion path = App Store rejection. Roye said: show cleanup proposal first, locate deletion as part of that (not a separate rush).

## GOAL (original, still holds)

## VERIFICATION MODEL
Strategist has Supabase MCP (project `gxrpunvhjcrzqnitbqah`) — DB fully checkable. Live web bundle checkable: `curl https://caps.ftable.co.il | grep index-*.js`. **PR diffs NOT checkable (private repo)** — accepted on the bot's self-audit track record; binding visual proof is Roye's device eye-test. Bot audits-before-coding and has caught a real trap every batch (including strategist's own mistakes) — trust but verify.

## SHIPPED & VERIFIED
- **S75** (live): paint-layer plumbing. `constants/paintThemes.ts` (`PaintTokens` type + `currentPaint` = 240-value Obsidian snapshot, 6 domains: colors 56/obsidian 24/home 100/card 27/visual 32/fonts 1). `PaintProvider`/`usePaint()` at root (now demoted to internal data accessor, NOT a user control). Merge 063c9bd.
- **S76 Commit 1a** (live, merge SHA 205b799, bundle index-e7c15422 verified): added `streetStencil` theme + `obsidian.cardGlow` (current=#4FD6A8) + registered `streetStencil` into the LIVE visualThemes delivery system as a THIRD VisualTheme value — **DORMANT**: default still 'classic', both pickers hardcode [classic,fiveo] so it's structurally unlistable, gate absent. Fixed a coupling that would've corrupted currentPaint (decoupled PaintTokens.visual → LegacyVisualPaintId, snapshot stays 32).

## ARCHITECTURE (settled — Option 2)
CAPS ALREADY HAS a live user-facing theme system: `visualThemes` (classic/fiveo), persisted in `gameStore.visualTheme`, with a Settings picker (settings.tsx) + dedicated screen (theme-pick.tsx), prop-threaded via `getTheme(visualTheme)` at render to ~7 surfaces, already live-switching with no reload (so R-G is already satisfied at these nodes). RULING: **paintThemes = DATA layer, visualThemes = DELIVERY. One selector = `gameStore.visualTheme`.** `VisualTheme` type declared in BOTH `store/gameStore.ts` AND `constants/visualThemes.ts` — both carry 'classic'|'fiveo'|'streetStencil'. Pickers hardcode options → new themes structurally invisible until S77 wires them (stronger than a runtime gate). Default stays 'classic' until a deliberate, eye-tested flip.

## 1b DEFERRED — WHY (important lesson)
Attempted: paint Board(42)+BoardArrangement(19) non-felt colour reads. CLASSIFICATION KILLED THE NAIVE SCOPE: all 36 "clean" reads are STATIC COLORS.*/OBSIDIAN.* (zero theme-routed; Board's only theme.* reads are the 6 animated ones, excluded). 30 sit in module-scope StyleSheet that can't read a prop. So "paint the 36" = a ~30-key DATA-MODEL change (new ThemeTokens keys + classic/fiveo pinning + fidelity pins) — the SAME kind of change we deferred for the felt, 10x bigger. Two silent-corruption traps found: routing COLORS.textMuted→theme.textMuted changes FIVEO (#9aa19b vs #bbbbbb); COLORS.neonGreen/neonRed ≠ winColor/loseColor. Only 3 reads are safe-to-route now (:817 boardBorder, :698/:993 mint→accent — classic & fiveo already identical).

## NEXT BATCH — "S76-BOARD" (the Board data-model batch, do as ONE isolated unit)
**READY TO RUN: the pin-stage GO prompt is already written — `VAMOS-CAPS-S76-BOARD-PIN-GO-2026-07-17-0042.md`. Re-issue it verbatim at the top of a fresh session. Before it, the before-audit was already done (`VAMOS-CAPS-S76-BOARD-BEFORE-AUDIT-2026-07-17-0039.md`) and its findings are baked into the GO prompt — do not re-audit, just run the pin stage.**
This batch is CHEAP with fresh context: Board's read list + token names are already enumerated; every token's CURRENT value already sits in `currentPaint` (constants/paintThemes.ts, from S75), so pinning is a LOOKUP against that file, NOT a rediscovery. The 3 safe reuses (verified value-identical on classic AND fiveo): COLORS.background #0a0a0a; COLORS.mint/OBSIDIAN.mint → theme.accent #4FD6A8; COLORS.boardBorder rgba(79,214,168,0.45). ~20 other keys get NEW entries pinned classic=fiveo=today. NO routing this batch (routing is its own later pass; that's where the name-collision traps live: textSecondary #9aa19b→#4FD6A8 mint, textPrimary→#ffffff fiveo, textMuted, neonGreen/neonRed). BoardArrangement = its own later increment (theme-unaware, needs prop-threading = API change). Felt stays OBSIDIAN.* 2-stop.

**The key count is UNKNOWN until the diff — do NOT size on "~30".** (Now refined to ~23 by the completed audit.) The pin-first diffing step PRODUCES the real key list as a by-product; enumerating legacy values IS the enumeration. Steps:
1. DIFF every Board/BoardArrangement colour read against its current rendered value across classic AND fiveo. The set of keys needing to exist falls out of this diff — that is the real count (candidates seen so far, unproven: COLORS.gold/goldLight/textDim; OBSIDIAN.slotDash/slotFill/slotDashActive/mintGhost/mintHairline/cardInk/autoBg/autoBorder/autoText/autoBolt; textMuted; neonGreen/neonRed).
2. For EACH key, pin classic AND fiveo to EXACTLY today's rendered value, with a fidelity assertion, and get all pins green — BEFORE any routing (theme.textMuted #bbbbbb on fiveo ≠ COLORS.textMuted #9aa19b proves assumption fails).
3. Set streetStencil's values for each key from the N8 mockup tokens.
4. ONLY THEN route Board/BoardArrangement's static reads to theme.* + fold in the 3 safe reads (:817 boardBorder, :698/:993 mint→accent — classic & fiveo already identical).
5. Felt 3-stop (feltTop/feltMid/feltBottom) can ride in this batch or its own — felt LinearGradient already exists at Board.tsx:550 as a proven backdrop (absolute fill + pointerEvents none), so 2→3 stop is pure paint; needs the same classic/fiveo-pinning care (felt is theme-independent today, always Obsidian).
6. EXCLUDE the 6 animated reads — Board is at 7 shared values (pre-existing debt, ≤5 guideline); Board must stay EXACTLY 7. NOTE they are TWO different problems: :420/421 + :496/497 = theme.accent (PROP captured inside a worklet — the harder fix); :447/448 = COLORS.boardFull / COLORS.neonGreen (STATIC constants merely sitting inside an animated block — trivial). Different fixes when that pass happens.
7. Verify: tsc 0, geometry grep zero (word-boundary, grep callers not const names), classic(16)+fiveo(8) pins byte-identical + all new keys pinned to today's values, Board 7 / BoardArr 0, no build change. Stage ONLY intended files (never git add -A). Hold merge for strategist.
This batch is bounded and finishable in a fresh context. Do it BEFORE-AUDIT-first.

**SAFE-STOP VALVE (S76-BOARD):** the pin-first diff will likely surface MORE keys than the candidate list — that is expected; do not size on the candidates. If context runs short, STOP AT THE PIN STAGE and merge that. A green pin set with ZERO routing changes nothing on screen — it is a safe, mergeable, honest increment. A HALF-ROUTED Board is NOT safe — that is the 1a failure mode and the one shape that can silently break the live app. Pins-only is always a valid stopping point; half-routing never is.

## RULING — pin-first vs 4→1 unification tension (resolved 2026-07-17)
The bot flagged: if unification retires classic/fiveo, why pin them in S76-BOARD? Answer:
- The post-unification colour axis is {streetStencil, olympus, volcano, marble} — so YES, classic AND fiveo are both destined for retirement (not just fiveo). They were the OLD colour themes the new ones replace.
- BUT retirement is the LAST step, its own deliberate high-risk batch, because `classic` is the current shipped DEFAULT. You cannot delete classic until a new theme has REPLACED it as default + been eye-tested + shipped to production.
- Therefore during S76-BOARD, classic/fiveo are still live/shipped/default → **pin-first stands EXACTLY as written.** The pins are load-bearing *during the transition*; skipping them now would break the currently-shipping app in the gap before retirement.
- The pins are NOT stranded: they get removed WITH classic/fiveo in the defined retirement batch below, as a clean deliberate teardown.
- DO NOT skip pinning now on the grounds that retirement is coming — that would break the live app.

## FINAL-PHASE BATCH (defined so the pins have a known end-of-life)
"RETIRE-LEGACY": after a new theme is the shipped production default AND all surfaces are themed AND eye-tested, retire classic + fiveo (and the folded-in HomeThemePicker/ButtonStylePicker/CardThemePicker legacy data) as user-selectable options, and remove their fidelity pins in the same batch. This is the teardown; until it runs, all legacy pins are maintained.

## AFTER BOARD: remaining roadmap
- **First DEV-BUILD eye-test (do this right after S76-BOARD lands):** flip default to streetStencil on a DEV BUILD ONLY so Roye finally sees the theme on-device before any production default change. This is the long-deferred visual test AND the thing Roye most wants — prioritise it.
- **SETTINGS CLEANUP + 4→1 UNIFICATION** (per NEW PRODUCT DECISIONS): consolidate HomeThemePicker/ButtonStylePicker/CardThemePicker INTO the unified theme so one choice drives all; delete the 3 separate pickers; present cleanup proposal to Roye before cutting; build vibration toggle + language row (verify language actually applies first); preserve Apple-required items (privacy/terms/account-deletion — trace deletion row before touching Danger Zone). A full settings-screen inventory already exists from the SETTINGS AUDIT (bot handoff) — use it.
- Paint remaining surfaces (Home, Results, Win, Matchmaking, Settings) — each may hit the same static-vs-theme-routed classification; treat per-surface, pin legacy themes every time.
- **Commit 2 (font)**: bundle **Bangers** (OFL; beats Rock Salt whose tall metrics clip fixed-height containers → would tempt a forbidden geometry fix). First font gate at root — isolate, eye-test startup. Resolves Card web-font-stack debt.
- **Commit 3 (texture)**: node-generated static concrete-noise PNG, low opacity, zero per-frame cost.
- **S77**: Settings→Appearance picker + live switch (confirm dialog). Wire premium_theme_enabled gate HERE (client-side; strategist creates the DB key at this point, not before). Mockup: CAPS-SETTINGS-APPEARANCE.png.
- **S78**: enable Olympus/Volcano/Marble as pure token data (same key set).
- **S79**: per-theme assets (card backs, chips, felt tint, holo).
- **S80**: QA/perf gate — 6× CPU throttle (V22 heaviest glow), 320/375/390/430 sweep confirming zero layout shift, shared-value audit per theme, web bundle weight, kill-switch, regression diff (geometry pixel-identical, only colour differs).

## PRE-EXISTING DIRTY FILES (NOT theme work — do NOT sweep into any theme commit)
Dirty in the tree since before this arc, unrelated to themes: `supabase/.temp/cli-latest`, `supabase/functions/crash-analyzer/index.ts`, `supabase/functions/whatsapp-bot-handler/index.ts`. Every theme commit must stage ONLY its intended files — never `git add -A`. Verify staged file list before each commit.

## S76-BOARD SEQUENCING (locked — pin BEFORE route)
Step 2 (pin classic+fiveo to today's rendered value) IS the batch, not a lookup. Proven: theme.textMuted #bbbbbb (fiveo) ≠ COLORS.textMuted #9aa19b. So: as a FIRST mechanical step, DIFF every legacy value the read-inventory surfaces (the count is UNKNOWN until this diff — the NEXT BATCH section is authoritative; do NOT re-import "~30") and pin each with a fidelity assertion. Only AFTER all pins are green do you route Board's reads to theme.*. If pinning and routing happen in the same motion, fiveo breaks silently and nothing catches it. Pin-first, route-second, non-negotiable.

## LOGGED DEBT (never fix inside a paint batch)
- Board.tsx: 7 Reanimated shared values, pre-existing, above ≤5. Own batch, throttle-profiled.
- Board 6 animated colour reads — own pass with the Reanimated batch. TWO distinct problems: :420/421 + :496/497 = theme.accent (prop captured in worklet — harder); :447/448 = COLORS.boardFull/neonGreen (static consts inside an animated block — trivial).
- Card.tsx:313 hardcoded '#FFFEF8' (stale pre-Obsidian cream, !isV2 path).
- Card web font stacks (:441/470/480/490/499) → resolve at Commit 2 (Bangers).
- GREP DEBT (not "approximate counts" — CONFIDENTLY WRONG numbers, 5×): failure modes were (a) matching generic CSS prop names, (b) substring collisions in colour keys (goldBright~right:, bgTop~top), (c) a char class silently skipping digit keys (chip1/5/25/100/500 → 51 not 56), (d) grepping a const NAME instead of its callers (VISUAL_THEMES "1 consumer" → actually 7 via getTheme). RULE: grep the CALLERS, use word boundaries, treat every count as UNPROVEN until a diff or test pins it. Strategist: never let a count drive a scope decision without the diff behind it.
- Dead/stale excluded from paint: design.ts CAPS_THEME, BOARD_IDENTITY (0 consumers).

## GATE STATE (verified 15:37)
`premium_theme_enabled` ABSENT (verified). Do NOT create it until S77. `hand_rake_pct=5`, `mp_board_reveal_enabled=true` present (unrelated, leave). Default theme 'classic' — do NOT flip to streetStencil except on a dev build until eye-tested + approved.

## STYLE POOL (if look questions reopen)
58 designs as phone PNGs in /mnt/user-data/outputs (V1–V22, X1–X10, L1–L7, C1–C5, K1–K6, N1–N8). Finalists were V2/V19/V22/X9/N2/N8; Roye chose N8 default + V19/V22/X9 switchable, dropped V2/N2. Per-style 5-screen sheets: CAPS-SHEET-*.png. Settings mockup: CAPS-SETTINGS-APPEARANCE.png. N8 tokens already in the streetStencil theme.
