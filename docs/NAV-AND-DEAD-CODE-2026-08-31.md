# NAV-AND-DEAD-CODE — 2026-08-31

Subtraction sprint: five tabs → three, de-duplicate destinations, remove proven-dead code.
**Client nav + dead files only. No DB, no economy, nothing built.** Branch
`claude/vamos-caps-align-celebration-flppo0` @ `eaf9201`. Verified: **jest 41 suites / 2,649 tests
green · tsc exit 0 · production web export builds clean.** Live browser loop could not run in this
container — see the honest note at the end.

## 1 — Five tabs → three
`app/(tabs)/_layout.tsx`: `friends` and `cups` set to **`href: null`** (expo-router's documented way to
drop a screen from the tab bar while keeping the route). Files stay in `(tabs)/`, so the paths
`/cups` and `/friends` are **unchanged** and nothing that links to them breaks.
- **Three tabs: Home / Play / Profile.**
- **Cups → Profile:** new menu row in `app/(tabs)/profile.tsx` → `/cups`. (5 cup-earners ever.)
- **Friends/Clubs → side menu:** new entry in `components/SideMenu.tsx` → `/friends`. (1 club, 2 members.)
- **Bottom bar at 320/375/393/430:** the label-hide boundary is unchanged — `tabBarShowLabel:
  SCREEN_W > 375`, so labels are hidden at 320 & 375 and shown at 393 & 430, exactly as before. Going
  from 5 to 3 items only *widens* each tab's slot, so there is no crowding regression at any width.
  (Verified by reading the layout logic; pixel-level confirmation was blocked — see the note below.)

## 2 — De-duplicate destinations
Each destination now has **one obvious route**; the redundant flat-menu entries were removed from the
**side menu** (the secondary drawer), which is where the true duplicates lived:
| Destination | Kept canonical path | Removed from |
|---|---|---|
| Play Online / lobby | **Play tab** (Multiplayer Lobby) + the big PLAY ONLINE CTA on Home | side menu |
| Stats | **Profile** menu row | side menu |
| Hand History | **Profile** menu row | side menu |
| Settings | **Profile** menu row | side menu |
| Leaderboard | **Play tab** (already deduped in a prior sprint) | — |
| Cups | **Profile** (new, this sprint) | (was the tab) |
| Friends/Clubs | **side menu** (new, this sprint) | (was the tab) |

The drawer now holds only items with no other home: **Battle Pass, Coaching, Tutorial, Language,
auth**, plus the relocated **Friends**. **Home's Hand History / Achievements / Leaderboard instances
were kept** — they are contextual progressive-disclosure cards (a "N hands saved" counter, a "My
Progress" achievements count, a "Competition" rank card, per-hand recent-hand deep-links), each with
dated design rationale, **not** flat nav duplicates. Every kept destination is still reachable
(routes unchanged; only drawer list-items were deleted).

**`/chip-store` vs `/shop`:** **`/shop` survives** — it is the one with entry points (two Home shop
buttons, the results-screen shop CTA) and it already shows the honest "chips come from playing / coming
soon" state when payments are off. `/chip-store` had **zero** entry points and duplicated `/shop`'s IAP
purpose, so it is **retired to `<Redirect href="/shop" />`** (the `/missions` pattern). A typed
`/chip-store` URL now lands on the canonical store.

## 3 — Remove proven-dead code
Each file proven unreferenced by a **repo-wide** import search (symbol-name grep, source-only,
excluding docs/build artifacts) before removal.

**7 files removed** (was "8" in the benchmark — one of the eight, `cardSizes`, is a keep):
- **4 with no references and no tests:** `components/LanguagePicker.tsx`, `constants/capsQuotes.ts`,
  `constants/design.ts` (`CAPS_THEME`), `utils/safeArea.ts`.
- **3 dead-prototype files + their dedicated tests, removed as pairs:** `utils/matchmaking.ts`,
  `utils/roomCode.ts`, `hooks/useRealtimeGame.ts` (superseded by `realtimeMultiplayer.ts` / `lobbyApi.ts`).
  **Correction to the benchmark:** it flagged only `cardSizes` as test-coupled, but these three are
  too — each has a test that covers *only* the dead file, so file + test were removed together and the
  suite stays green. `cardSizes` is **kept** because its test (`botStrategy.test.ts`) covers *live*
  `botStrategy` and merely references `CARD_SIZES` — removing it would break a live test.
- **`Card.small` / `Card.suitsOnly` residue:** both props were never passed by any caller (grep = 0),
  so their size-fallback and render arm were unreachable. Removed the props, the unreachable branch,
  and the two orphaned styles (`suitBottomLeft`, `suitOnlyText`). **`Card.themeOverride` kept** — it is
  inert in Card but 4 `simulate.tsx` sites pass it, so it is load-bearing for their typing.
- **`battle_pass_enabled` flag** removed from `constants/economyConfig.ts` — it was defined but read by
  no client code, so it read as a control while controlling nothing. **The Battle Pass screen stays**
  (Roye's ruling). The equally-unread `app_config.battle_pass_enabled` DB row is left for a future DB
  sprint (this sprint does not touch the database).
- **`/heatmap`** — orphaned (zero entry points) — **retired to `<Redirect href="/" />`** so a typed URL
  can no longer land on an unreachable screen (the `/missions` lesson). Not linked, because adding a
  destination is out of scope for a subtraction sprint.

**KILL_\* and slot-outline calibration — untouched, confirmed.** `KILL_Board`/`KILL_game`/`KILL_*` in
`utils/animationKill.ts` and the `0.6`/`0.75` slot-outline values in `constants/paintThemes.ts` were
**not** modified. They look dead and are load-bearing; left exactly as they were.

## 4 — Prove it did not break
- **jest: 41 suites / 2,649 tests, all passed** (exit 0). This includes the rules self-tests
  (`verify-rules.test.ts`) that exercise **2P / 3P / 4P board counts** and win/loss/tie outcomes — so
  "all three board counts" and "self-test planting its defects" are covered at the unit level.
- **tsc `--noEmit`: exit 0, zero errors** — types sound after every prop and file removal.
- **Production web export (`expo export -p web`): exit 0, bundle emitted** — my changes do not break the
  build Vercel ships.
- **No dangling references repo-wide** — no live import of any removed module; `small`/`suitsOnly`/
  `CAPS_THEME` appear only in comments, docs and stale build artifacts.
- **No migration, DB untouched** — the diff contains **zero `supabase/` files**; no economy value,
  faucet, rake, flag, art, felt or cue was touched.

### ⚠️ HONEST LIMIT — the live browser loop could not run in this container
The prescribed loop (both engines, 320/375/393/430, gated screens by config override, in a real
browser) **could not be executed here.** In this remote container the app **does not mount in a
browser** by either documented path:
- **Metro web dev server** (`expo start --web`): `#root` stays empty with a hard `SyntaxError: Cannot
  use 'import.meta' outside a module`. **This is a pre-existing, repo-documented blocker** —
  `utils/devRevealFixture.ts:27` records it (first seen 2026-07-10, "still live"), independent of this
  sprint's changes.
- **Production export** (`expo export -p web`, served as the `output:"single"` SPA): the built bundle
  hits the **same** `import.meta` bootstrap error in Chromium in this container, so no route mounts.
Both failures are app-wide (every route equally blank, including screens this sprint never touched) and
originate in the bundler/runtime bootstrap, not in any edited file. The prior sprints' live QA ran on
Roye's local machine, not this container. Per Iron Rule #14, this is reported as **not run**, not as a
pass — the nav evidence above rests on the test suite, the typecheck, the clean production build, and
static routing analysis. A device/local-web pass at the four widths remains for Roye's machine.

## Production unchanged
No economy value, faucet, rake, art/felt/cue, security fix, or `app_config` flag was touched. No
migration. `KILL_Board`/`KILL_game` still true. The only changes are client nav (three files) and the
removal of proven-dead files, props and one dead client flag.
