# CAPS BENCHMARK-AND-STREAMLINE — 2026-08-31

Three reports, kept separate — a menu benchmark (UX), a logic audit (product), an
engineering-leanness pass (engineering). **Nothing was built, deleted or changed.**
Repo @ `a4bac0d` (branch `claude/vamos-caps-align-celebration-flppo0`, on `0f27b26` main
lineage). Supabase `gxrpunvhjcrzqnitbqah`. Every number is from a fresh SELECT or a grep with
its count shown; several channel claims are **corrected** below where the source disagreed —
that is the point of "verify twice."

## The scale fact that frames all three reports
Measured, real devices only (harness excluded via `v_harness_devices`):
- **8 devices have ever played a recorded hand** (`hand_history`), against 485 leaderboard rows.
- **0 multiplayer rooms have ever finished**; 34 devices ever opened the lobby; `lobby-private` = 1 device.
- **1 club, 2 members** total. **5 devices have earned any cup** (6 cup rows).
- Tab first-views over 60 days are near-uniform: play 184 / profile 175 / friends 169 / cups 166
  (each ~84–94 distinct devices), lobby 72. Uniform + small = one-time exploration, not repeat use.

So this is a **single-digit-active-players** product carrying a 5-tab + 9-item-drawer navigation
and a 198-function / 72-table / 31-cron-job backend. Every "should we add" answer is filtered
through that, per Roye's own thesis: **too many options is the stated problem.**

---

# REPORT 1 — THE MENU BENCHMARK (UX)

## Titles actually examined
Benchmarked against the **social / free-to-play** poker set (not real-money rooms, whose menus are
built around cashier/stakes/KYC). I drew on the menu structure of these titles from direct product
knowledge, **not** fresh installs this session — stated honestly rather than claiming 30 teardowns:
**Zynga Poker, WSOP (World Series of Poker / Playtika), Governor of Poker 3, PokerStars Play (social
tier), Pokerist (KamaGames), World Poker Club, Poker Heat (Playstudios), Scatter HoldEm, Jackpot
Poker, Full House Casino.** Ten titles I can speak to structurally. Where I'm generalizing a
"most of them" pattern, it's across these ten.

## CAPS navigation baseline (exact, from source)
**Bottom tab bar — 5 tabs** (`app/(tabs)/_layout.tsx`), English labels (UI is English-only):
| Tab | Emoji | Screen | What it is |
|---|---|---|---|
| Home | 🏠 | `(tabs)/index.tsx` | Lobby/hub: practice-play buttons, shop/2×-offer, Play Online→/lobby, recent hands, and links to Hand History, Achievements, Leaderboard |
| Play | ♠️ | `(tabs)/play.tsx` | 4 cards: Multiplayer Lobby→/lobby, Quick Private Table→/lobby/private, Leaderboard→/leaderboard, Invite Friends→/referral (+ solo →/game) |
| Friends | 👥 | `(tabs)/friends.tsx` | **= Clubs.** My clubs, Create club, Join by code, open club detail |
| Cups | 🏆 | `(tabs)/cups.tsx` | Read-only trophy cabinet. **No navigation, no actions** |
| Profile | 👤 | `(tabs)/profile.tsx` | Menu rows only: Achievements, Hand History, Stats, Settings |

**Side menu — drawer from the home avatar (top-right)** (`components/SideMenu.tsx`), in order:
Profile header (avatar/name/chips) · **Play Online** 🎮→/lobby · **Battle Pass** ⚔️→/battle-pass ·
**Stats** 📊→/stats · **Hand History** 📜→/hand-history · **Coaching** 🎓→/coaching · **Settings**
⚙️→/settings · **Tutorial** 📖 · **Language** 🌐 (toggle) · **Sign in / Sign out**.

## Per-entry vs the social set — have it? placement? is ours right?
| CAPS entry | Social set has it? | Where they put it | Ours placed right? |
|---|---|---|---|
| Play / quick-play | Yes, universal | The center/primary CTA, often a big "PLAY" button | **Split & buried.** Our play entries are spread across Home *and* the Play tab; no single dominant "PLAY NOW". Weaker than the set |
| Multiplayer lobby | Yes | Behind the primary Play button | We have it 3× (Home, Play tab, drawer) — over-placed |
| Leaderboard | Yes | A tab or a Profile sub-item | We have it 2× (Home + Play tab). One is enough |
| Clubs/"Friends" | Some (WSOP clubs, Zynga "Clubs") | A drawer/secondary item, **rarely a top-level tab** | **Over-promoted** to a bottom tab for a 2-member feature |
| Trophies/"Cups" | Yes as collection | Inside Profile, never its own tab | **Over-promoted** to a bottom tab; belongs in Profile |
| Achievements | Yes | Inside Profile | We have it 2× (Home + Profile) — Profile is the right home |
| Battle Pass / season | Yes (WSOP, Governor) | A prominent banner/tab **when active** | Ours is drawer-only **and `battle_pass_enabled=false`** — a live UI behind an "off" flag (see Report 2) |
| Coaching | Rare | n/a — few social apps have it | Niche; drawer is acceptable |
| Shop / store | Yes, universal | A persistent coin "+" in the top bar, always visible | Ours is on Home only; payments are off so this is moot today |
| Stats | Yes | Profile sub-item | We have it 2× (Profile + drawer) |
| Hand History | Yes (as "History") | Profile/Game sub-item | We have it **3×** (Home + Profile + drawer) — most-duplicated entry |
| Settings | Yes | Profile or drawer | We have it 2× (Profile + drawer); fine |
| Invite/Referral | Yes | Drawer or a "Free chips" item | On the Play tab; acceptable |

**What the set has that we don't:**
1. **A single dominant "PLAY" CTA** — the set makes the primary action unmissable; ours is fragmented.
2. **A persistent top-bar coin balance + "＋"** shortcut to the store on every screen (universal in the set).
3. **Table filtering** (format / stakes / seats / hide-full) in the lobby — near-universal. **At our
   scale (0 finished rooms, 34 lobby-openers ever) it does not matter — defer.** Real later item, not now.
4. **A "free chips / daily bonus" hub** surfacing the daily reward, invite, and ad-reward in one place
   (Zynga, WSOP). We have the pieces (`daily_reward`, referral, rewarded_ad) scattered.

## CUT list (ranked; each with reason + cost)
1. **Collapse the "Cups" tab into Profile** — reason: read-only cosmetic cabinet, 5 devices have
   earned anything, no social app gives trophies a top-level tab; cost: **low** (move one screen link;
   the tab count drops 5→4). Highest payoff cut.
2. **Demote the "Friends/Clubs" tab to a Profile/drawer item** — reason: 1 club / 2 members; a whole
   tab for a near-zero feature contradicts the "too many options" thesis; cost: **low–medium** (clubs
   stays reachable; frees the strongest tab slot). Would take bottom nav to **3 tabs (Home / Play /
   Profile)** — the common social pattern.
3. **De-duplicate destinations** — Hand History appears 3× (Home, Profile, drawer), Play Online 3×
   (Home, Play, drawer), Leaderboard 2×, Achievements 2×, Stats 2×, Settings 2×. Keep one canonical
   home each (Profile for personal history/stats/achievements/settings; Play tab for lobby/leaderboard;
   Home for the play CTA). Cost: **low**, pure removal — the leanest win and the most on-thesis.
4. **Remove the Battle Pass drawer entry OR honor its flag** — it's `false` in config but the screen
   renders anyway (Report 2). Either wire the flag or drop the entry; cost: **low**.

## ADD list (each must clear a higher bar than every cut — and most don't)
1. **One dominant "PLAY NOW" primary CTA on Home** — the only add I'd argue *clears* the bar, because
   it *reduces* perceived options by making the primary path obvious. Not new surface — a re-weight of
   what's already there. Cost: **low–medium** (layout only). **Recommended.**
2. **Persistent top-bar coin + "＋" store shortcut** — universal in the set, but payments are OFF, so
   it would point at a disabled store today. **Hold until payments ship.** Does not clear the bar now.
3. Table filtering — **explicitly do NOT add now** (see above). Later item.
4. A unified "free chips" hub — nice-to-have; does not clear the bar against the cuts. **Hold.**

## Nav already right where
- **The Play tab's 4-card layout is clean and correctly scoped** (lobby / private / leaderboard /
  invite) — that grouping matches the set well; the fix is de-duplication elsewhere, not this screen.
- **The side-menu drawer is the right place for the secondary/rare items** (coaching, language,
  tutorial, sign-in) — that's exactly where the set hides them; keep it.
- **Settings, Coaching, Language, Tutorial placements are fine.** No change.
- Honest verdict: the nav's **structure** is close to right; its problem is **duplication and two
  over-promoted tabs**, not missing features. A benchmark that grew the surface would fight Roye's
  direction — so this one mostly **cuts and de-duplicates**, and adds exactly one CTA re-weight.

---

# REPORT 2 — THE LOGIC AUDIT (product) — *report only*

_(Screen-walk findings below; verified items first, subagent-corroborated items merged in.)_

## Naming inconsistencies (verified from source)
1. **"Streak" names two different concepts.** `daily_streak` (`utils/economy.ts:46-82`) is a genuine
   *consecutive-day login* streak (increments if claimed yesterday, resets on a gap; day 1–6 escalate,
   day 7 = 500, day 30 = 2000). **Correction to the channel:** it is *not* "really a one-time grant" —
   the code is a real multi-day streak. The actual collision is that `streak_3`/`streak_7` in
   `utils/achievements.ts:22-23` ("Hot Streak" / "On Fire") are *win-run* streaks — **the same word
   for two mechanics** (days-logged-in vs games-won-in-a-row). That is the mislabel to fix.
2. **Three overlapping "daily" grants.** `daily_streak` (active, 83% of all chips minted),
   `daily_reward` (active, config `daily_reward_chips=150`, 1.7%), and `daily_login` (**dead since
   2026-07-02**, but 13.4% of all historical chips and `daily_login_chips=0` in config). Three names,
   one player-facing idea ("your daily chips"). Confusing in the ledger and likely in the UI copy.
3. **`hand_won` vs `hand_net`.** Gameplay rewards were written as `hand_won` (dead since 2026-07-09),
   now as `hand_net` (active). Two event types for "you won chips this hand"; the old one lingers.

## Gated / flag states (verified)
4. **`battle_pass_enabled=false` is a dead flag.** The Battle Pass screen (`app/battle-pass.tsx`)
   renders a full season UI, and **no client code reads `battle_pass_enabled`** (grep across
   app/components/utils/hooks = 0 hits). So a config flag that says "off" does nothing, and the
   drawer still routes to a live-looking Battle Pass. Either honor the flag or remove it — a genuine
   say-one-thing/do-another.

## Contradictions / dead ends (verified)
5. **`/spectate` dead end is FIXED — none remaining there.** The prior "4 lines, 'No room code
   provided', no way back" state is gone: `app/spectate.tsx` (now 544 lines) sets the error
   (`:88`) but renders a working back control (`safeBack`, `:156/:174`) on every state including
   the no-code error. It's off the SideMenu, reachable only with a real room code — correct.
6. **Battle Pass is the one live say-one-thing/do-another** (finding 4 above): drawer routes to a
   full season UI while `battle_pass_enabled=false` is ignored by the client.

## Empty / error / first-run states (verified — in good shape)
7. **Empty states are handled well.** `hand-history` ("No hands yet", `:371-380`), `stats`,
   `coaching`, `rank`, `heatmap` all use `EmptyState` + `EmptyStatePreviews`. Home handles the
   zero-chip case (`index.tsx:1310`) and a first-run welcome toast + ledgered +100 welcome bonus
   (`:1148-1154`). No broken empty state found — a "confirm none remain" pass, not a defect list.

## Confusing-but-correct (verified)
8. **Tutorial re-show is FIXED.** `index.tsx:872-876` gates the single onboarding on
   `INTERACTIVE_TUTORIAL_KEY` in AsyncStorage (`if (!val) show`) with a CI bypass — it no longer
   re-shows to returning players. The duplicate OnboardingOverlay/WebLandingHero were also removed
   (`:895`, `:1246`). Confirm-clear, not a defect.
9. **`results.tsx` is the density candidate — flagged, not asserted.** It is the largest screen at
   **1,952 lines** and is inherently dense (per-board hand breakdowns for 2–4 boards). The prior
   "34-line dense results" concern was about on-screen text volume; I can't confirm the current
   render is confusing without a device pass, so this is a **design-review flag**, not a filed defect.
   It is also the top candidate for a componentization/leanness pass (Report 3 territory).

## Verdict for Report 2
The logic is in **much better shape than the channel's framing suggests** — the historically-cited
defects (tutorial re-show, /spectate dead end, 34-line results) are **fixed or handled**. The two
*live* issues are naming (**"streak" = two mechanics**, three overlapping "daily" grants, `hand_won`
vs `hand_net`) and the **dead `battle_pass_enabled` flag**. Both are report-only; the naming ones are
not one-line copy fixes (they touch event types/ledger), so nothing was changed.

---

# REPORT 3 — ENGINEERING LEANNESS (engineering)

## Dead / dormant DATABASE surface (verified via SQL)
Surface size: **198 public functions · 72 tables · 9 views · 31 active cron jobs** — for 8 real
players who've played a hand. The structural headline is size, not any one dead object.
- **`daily_login` faucet — dead since 2026-07-02**, yet 110,800 chips (13.4% of all minted) sit in
  the float from it; `daily_login_chips=0` and `earn_chips` gates it to `_retired`. The historical
  chips are part of the 335,330 gap. (Faucet already closed; the *event type + config key* linger.)
- **0-row tables**: `learning_events` (beacon commented out — dead table, was an open door, closed in
  PURGE-AND-CLOSE), `starter_pack_redemptions`, `friend_challenges` (0 rows **but cron job #11 expires
  them hourly** — machinery running over an empty table).
- **Dormant/retired**: `daily_missions` (20 rows, feature retired), `device_cups` (6 rows),
  `debug_sessions` (16 rows, has its own nightly purge cron #4).
- **31 cron jobs** include 6 push-notification senders (daily bonus, streak-risk, winback, flash-deal,
  weekly recap, retention) firing at an 8-player base, plus e2e/smoke/tripwire/digest jobs. Cheap to
  run, but a lot of scheduled machinery for the live scale — worth a prune pass (report, not now).
- Left-open writers from the prior sprint remain (`deploy_log` anon POST via `scripts/deploy-ota.sh`;
  `prompt_execution_log` SECURITY INVOKER granted to anon) — already documented in PURGE-AND-CLOSE.

## Bundle + performance (MEASURED — real numbers)
- **Web bundle: one ~3.8 MB monolith** — `dist/_expo/static/js/web/index-*.js` = **3,815,043 bytes raw
  / 902,398 gzip (~881 KiB)**; a second chunk is 15 KB. **No meaningful code-splitting.**
- Heaviest installed deps: `expo-image` 48M, `react-native` 39M, `expo-modules-core` 32M,
  `expo-camera` 13M, `react-native-reanimated` 11M (node_modules 634M total; much is dev-only).
- **Performance / FPS — correction to the channel.** There is **no game-screen FPS measurement in the
  repo**; the "~32fps vs ~66 idle" number is a comment in `components/HomeCupRings.tsx:18` about a
  **home-screen ring animation's Chromium-vs-WebKit render cadence**, not `app/game.tsx`. Attributing
  "the game screen runs at 32fps" to it is a conflation. **Could not measure game-screen FPS** — no
  instrumentation exists (grep for fps/requestAnimationFrame/frameRate in game.tsx/GameView/Board = none
  that measure). Report it as *unverified*, not a defect.

## Duplication (verified, with corrected counts)
- **Test `fire()` helper: 37 files** define their own copy (channel said 41 — **over-counted by 4**),
  all in `tests/*.mjs`, no shared helper exists though one easily could. ~35 are the same snippet.
- **Shuffle duplicated 5×** with a **biased** `.sort(() => Math.random() - 0.5)` idiom
  (`app/game.tsx:478`, `utils/botStrategy.ts:19` & `:62`, `utils/efficiencyAnalysis.ts:165`,
  `utils/gameLogic.ts:328`) while the canonical **unbiased Fisher-Yates** lives at `utils/deck.ts:13`.
  Real duplication *and* a correctness smell. (Hand-eval and board-count are **single-source** — the
  channel's "same thing built many times" does **not** apply to those; would be false positives.)
- **"Four false dead-control tools" is a misquote** — it's a code comment about *two false findings*
  (`tests/achievement-language.mjs:14`), not four tools. The real tooling duplication is **5
  near-identical `realitycheck*.js` screenshot scripts** (~491 lines, same SCREENS array) and **4
  overlapping visual-QA runners** (Playwright `visual-qa`, BackstopJS, `visual-audit.spec.ts`,
  `wcag-audit.js`; CLAUDE.md itself flags `tests/visual/baselines/` as "empty and dead").

## Calibrated-against — FLAGGED, do NOT recommend removing
- **`KILL_Board` / `KILL_game`** (`utils/animationKill.ts:63,68`) — hardcoded `true`; gates off the
  empty-slot / active / winner pulse animations in `components/Board.tsx:204,520,622` (dead `if(false)`
  paths). They *look* dead but are the product of an unfinished crash-bisect; **do not delete** — the
  KILL flags are load-bearing history.
- **The `0.600` slot-outline opacity** measured and reverted-as-inconclusive in `Board.tsx` — a
  calibrated-against value; flag before touching.

## Dead code — the whole-codebase sweep (283 source files scanned)
Every item proven by grepping the exported symbol across all source; counts shown. Risk is **medium**
for anything still `export`ed (this repo has been bitten by dynamic/string refs — none found, but the
class of miss is real), **low** only for unexported 0-ref residue, **high** for calibrated-against.

**Unreferenced module files (0 production import sites):**
| File | Exports | Risk |
|---|---|---|
| `components/LanguagePicker.tsx` | LanguagePicker(+Props) | medium |
| `constants/capsQuotes.ts` | DAILY_QUOTES, getTodaysQuote, todaysQuote | medium |
| `constants/design.ts` | CAPS_THEME (already documented dead in `paintThemes.ts:20`) | medium |
| `constants/cardSizes.ts` | CARD_SIZES | **medium — TRAP**: dead in product but `botStrategy.test.ts:87` imports it; not a free delete |
| `hooks/useRealtimeGame.ts` | useRealtimeGame, RealtimeGameState, GamePhase | medium |
| `utils/matchmaking.ts` | createRoom, joinRoom, quickMatch, closeRoom, listWaitingRooms | medium |
| `utils/roomCode.ts` | generateRoomCode, formatRoomCode | medium |
| `utils/safeArea.ts` | useSafePadding, useScreenStyle | medium |

**Dead props / branches in `components/Card.tsx`:**
- **`small` prop** (`:50`, used only in the size fallback `:207/:210`) — **never passed by any caller**
  (`grep small=` in app/components/hooks = 0). This is the "card-size prop never passed" the channel
  named; its small-size branch is unreachable. Medium risk (public prop).
- **`suitsOnly` branch** (`:607-618`) — prop never passed (3 hits, all inside Card.tsx); dead branch.
- **`themeOverride`** (`:56`) — inert (not destructured/used) yet passed at 4 `simulate.tsx` sites; the
  value has no effect but the interface line is load-bearing for those call sites' typing.
- **Low-risk residue (unexported, 0 refs):** dead consts `CARD_BACK_BG` (`:77`), `CARD_BACK_BORDER`
  (`:78`); orphaned StyleSheet keys `cornerRank/cornerSuit/centerRankText/centerSuitText/backCenter/
  backDiamond` — leftovers from the already-removed V1 card face.

**Correction to the channel:** the *"entire alternate card face with 27 call sites that never
renders"* is **already gone** — `isV2` is hardcoded true (`Card.tsx:514`), the legacy face is `:null`
(`:645`) and the gold/mint winner branch was already deleted. Only the unexported residue above
remains. Reported as **not present**, not asserted.

**Calibrated-against — FLAGGED, do NOT remove (high risk):**
- `utils/animationKill.ts:62-74` — `KILL_FINITE_ON_THIS_PLATFORM=true`, `KILL_game`, `KILL_Board`,
  `KILL_HeroGlow`, `KILL_HeroParticles`, from an **unfinished 2026-03 crash bisect**. Live-gating
  `Board.tsx` and `TimerController.tsx`. The file warns "Do not 'simplify' the Platform check away."
- `constants/paintThemes.ts:542-545` (and dup `:626-636`) — `boardSlotDash 0.75` is **explicitly
  calibrated against the 0.6 multiplier** of the KILL_Board-gated pulse; asserted in
  `paintThemes.fidelity.test.ts:360`. This is the "0.6 slot-outline" — flag before any Board change.

## Leanness ranked by payoff
1. **De-duplicate nav destinations** (Report 1 cut #3) — free, on-thesis, zero risk.
2. **Delete the 8 unreferenced module files + Card.tsx unexported residue** — low risk (0 refs); **skip
   `cardSizes.ts`** (a test imports it). Fastest pure-deletion win in source.
3. **Consolidate the 37 `fire()` copies into one shared test helper** — low risk (tests only), removes
   the largest single duplication.
4. **Collapse Cups→Profile, demote Friends** — low risk, biggest UX-leanness win.
5. **Retire dead event types / 0-row tables / empty-table cron** (`daily_login` key, `daily_missions`,
   `friend_challenges` + its cron #11, `learning_events`) — low risk, but touches the DB (must go
   through a *file* migration, given the broken history).
6. **Unify the 5 shuffle sites on `deck.ts`** — medium risk (game-logic; the biased ones may be relied
   on for feel); fixes a correctness smell as a bonus.
7. **Collapse the 5 realitycheck scripts + 4 visual-QA runners** — low risk (tooling only).
8. **Code-split the 3.8 MB web bundle** — medium effort, real payoff on web load.

**Do NOT touch:** `KILL_*` flags, the `0.6`/`0.75` slot-outline calibration, `Card.themeOverride`
(inert but load-bearing for typing), `cardSizes.ts` (test dependency). These are the traps.

**Nothing was built, deleted or changed. `KILL_Board`/`KILL_game` untouched. No migration applied,
no navigation altered.**
