# CAPS THEME — CURRENT STATUS (2026-07-17 ~01:40 IST) — read this first, then the full handoff

## LIVE STATE (strategist-verified)
- main = **b3bf09a**, live bundle **index-d72ec102** (verified served by caps.ftable.co.il).
- DB gate premium_theme_enabled ABSENT. Default 'classic'. streetStencil DORMANT + UNROUTED. Prod looks exactly as today.
- Build unchanged: 2.7.0 / ios 330 / android 90 (OTA-only).

## SHIPPED THIS SESSION: S76-BOARD pin + FILL11
- 19 new board* keys pinned classic=fiveo=today (+3 reused = 22 distinct/23 audited).
- All 19 streetStencil board values REAL (0 TODO). The 11 filled via expert-panel + Roye approval:
  gold = Variant A warm gold #F8C020 (distinct from spray-yellow, so a win reads as a prize);
  goldLight #FFD84D, goldBright #FFE87A; textDim #8a8a90 (concrete-grey, readable — mint-grey vanished);
  slotFill rgba(248,240,80,0.06), slotDash rgba(248,240,80,0.45), slotDashActive #F8F050
    (alphas BUMPED from mint's 0.03/0.30 — correct: yellow-on-concrete is lower-contrast than mint-on-black, COUNCIL-confirmed);
  autoBg #18181c (solid charcoal), autoBorder/autoText/autoBolt #F8F050.
- ZERO routed → invisible. tsc 0, jest 2587, 38 pins byte-identical, Board+BoardArrangement diff EMPTY, 7 shared values, geometry zero.

## NEXT: BOARD ROUTING (colour finally appears) — fresh session, BEFORE-AUDIT-FIRST
Connect Board's reads to theme.* so streetStencil paints Board.
- **COUNTS ARE SMOKE ALARMS, NEVER TARGETS.** Do NOT write a number into the routing prompt as the scope. Every bad count this arc (51→56, 8+21→14, 19→31→32, 21→24) came from carrying a number instead of re-deriving it. Instead the prompt gives: (a) the regex to search, (b) the explicit unit **"occurrences, not lines"** (line 154 alone carries TWO routable reads: COLORS.neonRed + COLORS.textSecondary, plus a raw #FFD700 that stays), and (c) "enumerate the full table and post it BEFORE writing any code." The table drives scope; the number only sanity-checks the table. Rough expectation for the alarm: ~32 routable occurrences across ~31 lines.
- **RE-PROVE at routing time**: Board reads via getTheme(visualTheme) (visualThemes path), NOT usePaint(). DEFAULT_PAINT_THEME='streetStencil' is STILL ARMED (untouched). getTheme keeps classic=classic; usePaint path would paint streetStencil in prod instantly. Re-prove, don't trust.

## THEN: BOARD LITERALS/PANEL INCREMENT (pin-first) — BEFORE the dev-build flip
After routing, colour reads stay hardcoded (rough alarm: ~24 occurrences across ~22 lines — re-derive, don't target). Without fixing them the dev-build flip shows a MIX (reads as BROKEN):
- Board PANEL reads OBSIDIAN.bgTop/bgBottom/bgFallback (lines 532/535/551/814, several carrying TWO occurrences) → panel stays NEAR-BLACK, not N8 concrete. Theme it to concrete.
- COLORS.boardFull at line 447 (do not drop it).
- Old gold #c9a84c at 1001/1006/1014/1104 → fights new #F8C020. Two golds.
- Mint literal at 1149. Raw #FFD700 at 154.
Own pin-first increment (classic/fiveo pinned to today). ONLY AFTER this is Board coherent enough to flip.

## THEN: DEV-BUILD DEFAULT FLIP = Roye's first on-device Street Stencil look
Flip default→streetStencil on a DEV BUILD ONLY. Must come AFTER routing + literals/panel, so the first look is COMPLETE Street Stencil, not a half-painted mix. This is the payoff — protect it by not flipping early.
Then BoardArrangement (theme-unaware → prop-threading = API change, own increment), then remaining surfaces (Home/Results/Win/Matchmaking/Settings), each pin-first.

## LANDMINES (do not trip)
- **`goldDim` is MISNAMED**: comment-only at Board:1148 (NOT a live read — grep may flag it), and its value is rgba(79,214,168,0.65) = MINT despite the "gold" name. Do NOT route it, do NOT trust its name, do NOT "fix" its value assuming gold.
- **keys ≠ reads ≠ lines**: one key is read many times; one line can carry several reads (line 154 carries two). NEVER size a batch on a count from any layer — re-derive from the enumerated table every time. Any number in this doc is a smoke alarm, not a target. (A figure restated in a summary outlives its correction — that is how "3+16" and "10 colours" survived past being fixed. The principle survives recounts; the figures don't.)

## NEW DEBT LOGGED
- `npm run ota` + `npm test` BROKEN on Windows (POSIX NODE_OPTIONS= prefix + /tmp path via cmd.exe). Bot ran steps manually. FIX: cross-env for NODE_OPTIONS + OS-neutral temp path. Own small batch, NOT inside a paint batch.
- DEFAULT_PAINT_THEME='streetStencil' armed tripwire — hard blocker on the FIRST usePaint() migration (decide: set back to 'current' vs deliberate flip). Not Board's concern if getTheme re-proven.

## STILL PENDING (product, after Board is visible)
Settings 4→1 unification (delete HomeThemePicker/ButtonStylePicker/CardThemePicker, one theme drives all); build vibration + language rows; settings cleanup (proposal before cutting); trace account-deletion row before touching Danger Zone. Full settings inventory exists in the SETTINGS AUDIT handoff.

## FULL CONTEXT — RESOLVED: now committed to the repo (2026-07-17)
Both docs are now in `docs/handoffs/`, so a fresh session can open them by path — no pasting, no download links, no chat dependency.
- **`docs/handoffs/CAPS-STRATEGIST-HANDOFF-2026-07-16-1537.md`** — Option-2 architecture (paintThemes=data, visualThemes=delivery, one selector gameStore.visualTheme), all rulings, RETIRE-LEGACY end-of-life, grep-debt lessons, product decisions (4→1 unification, vibration+language, settings cleanup). **It carries a SUPERSESSION BANNER — read it.** The doc predates S76-BOARD shipping, so its "NEXT BATCH — S76-BOARD … READY TO RUN, re-issue verbatim" is STALE and would re-run shipped work. Where this status doc and the handoff disagree, THIS doc wins.
- **`docs/handoffs/` also holds** `prompts/VAMOS-CAPS-S76-BOARD-PIN-GO-2026-07-17-0042.md` (committed) — the prompt that produced the shipped pin stage, kept as the record of the protocol that worked.
- **SETTINGS AUDIT findings**: NEVER written to a file — they existed only as a bot chat handoff and are now lost to history. Do NOT reconstruct from memory. **RE-RUN the read-only settings audit** in the fresh session (cheap; re-deriving from actual code beats a remembered summary — same principle as never carrying a count). ⚠ The audit prompt `VAMOS-CAPS-SETTINGS-AUDIT-2026-07-17-0023.md` **DOES NOT EXIST** either (verified against the repo 2026-07-17) — an earlier version of this line claimed it did. Write a fresh read-only audit prompt; do not go looking for that file.
- **STYLE POOL** (58 design PNGs, N8 tokens, settings mockup) lives in the strategist's sandbox `/mnt/user-data/outputs` — **no bot session can open that path**. Re-attach the PNGs directly if look questions reopen.

## DURABLE RULINGS ALREADY IN PROJECT MEMORY (survive without any file)
22-distinct/23-audited key breakdown; name-collision traps (textSecondary/textPrimary/textMuted, neonGreen/neonRed ≠ win/lose); Variant-A warm gold #F8C020; DEFAULT_PAINT_THEME='streetStencil' armed tripwire; Windows npm test / npm run ota breakage; goldDim-is-mint landmine; keys≠reads≠lines / counts-are-smoke-alarms principle.
