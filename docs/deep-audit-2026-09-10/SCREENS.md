# Screens and routes — 33 routes, measured 2026-09-10 on `ef55640`

Route list derived from `app/` (37 files minus 4 `_layout.tsx`). Reachability was measured by grepping every `router.push/replace`, `<Link href>`, `<Redirect>` and `Tabs.Screen` in `app/`, `components/`, `utils/`, `stores/`, `store/`, `contexts/`, `hooks/`, `constants/`; each inbound claim below was re-checked by hand on the cited line. R = reachable by tapping · U = URL only · → = redirects · flag = what gates it.

## Tab bar (`app/(tabs)/_layout.tsx`): three visible tabs, two hidden routes

| route | purpose | reached by | state |
|---|---|---|---|
| `/` | Home: practice hand, Play Online, daily bonus, side menu, bug report | app opens here; 28 inbound sites | R |
| `/play` | Play hub | tab bar (`_layout.tsx:82`) | R · reads client const `ECONOMY_FLAGS.matchCostEnabled` (`play.tsx:37`) |
| `/profile` | Profile | tab bar (`_layout.tsx:98`) | R |
| `/friends` | **Clubs** (create / join by code) | `href:null` (`_layout.tsx:95`); SideMenu.tsx:161 only — **not from Home** | R |
| `/cups` | Cups | `href:null` (`_layout.tsx:96`); profile.tsx:58 only — **not from Home** | R |

## Reachable off the bar

| route | purpose | reached by (measured) | guard / flag |
|---|---|---|---|
| `/game` | the hand | 17 sites: play.tsx:46, index.tsx:1061, results.tsx:945 … | buy-in charged on commit, not mount |
| `/results` | hand result | game.tsx:937, multiplayer-game.tsx:816 | `if (!revealData) router.replace('/')` at mount (:315) |
| `/gameover` | out of chips | results.tsx:947 | `<Redirect href="/">` when chips ≥ next-hand cost (:75) |
| `/lobby` | table list | 12 sites: play.tsx:65, index.tsx:1482 … | `PRACTICE_LIVE_ENABLED=false` (constants/featureFlags.ts:28) at :223 |
| `/lobby/private` | private table | play.tsx:74 — **from the Play tab, not from Lobby** | — |
| `/lobby/table` | seated table | lobby/index.tsx:144, lobby/private.tsx:61, club/[code].tsx:76, WaitingSeatBanner.tsx:50 | `!roomCode \|\| !isOnlineMultiplayerAvailable()` → error (:111) |
| `/multiplayer-game` | live MP hand | lobby/table.tsx:179, results.tsx:893, PracticeLiveOverlay.tsx:48 | app_config `mp_board_reveal_enabled` (isMpBoardRevealEnabled :805/:965) and `mp_server_adjudication_enabled` (utils/serverAdjudication.ts:18) |
| `/hand-history` | past hands | profile.tsx:50, results.tsx:1573, index.tsx:1686 (5 sites) | share rows hidden on web |
| `/replay` | one hand | hand-history.tsx:350 | — |
| `/settings` | settings | profile.tsx:62 | `__DEV__` block :1244; `caps_dev_unlocked` (AsyncStorage) gates Simulation button :1243 |
| `/shop` | chip shop | index.tsx:1335, index.tsx:1345 (two Home buttons), chip-store redirect — **no chip-count or side-menu entry** | `isIapEnabled()` (:215/:239) — always false, see FINDINGS |
| `/leaderboard` | ladder | play.tsx:83, index.tsx:1727 — **Home and Play, not Profile** (profile.tsx:61 says removed) | — |
| `/achievements` | achievements | index.tsx:1714, profile.tsx:44 | — |
| `/stats` | statistics | profile.tsx:53 | — |
| `/rank` | rank detail | settings.tsx:1426 — **from Settings, not Profile** | — |
| `/referral` | invite | play.tsx:92 — **from the Play tab, not the side menu** | — |
| `/invite/[code]` | accept an invite | external link only (`constants/appLinks.ts:45 buildInviteUrl`) | error state on bad code (:38) |
| `/coaching` | coaching | SideMenu.tsx:189, results.tsx:1594, replay.tsx:239 | — |
| `/club/[code]` | a club | friends.tsx:62 (tap on /friends) — **no club-link builder exists** | renders for any typed code (known, unfixed) |

## URL-only (no tap path anywhere in the app) — measured, three of these the product map called reachable

| route | what happens | note |
|---|---|---|
| `/theme-pick` | renders the theme picker; on pick → `/orientation-pick` or `/` | only inbound is `_layout.tsx:592`, a fallback that fires when `visualTheme === null`, which is seeded `'classic'` at :278 and so never fires. Settings changes the theme inline (`VisualThemePicker`, settings.tsx:723). Product map said "Settings · R". **U** |
| `/orientation-pick` | portrait/landscape choice; native only (`Platform.OS !== 'web'` :10) | inbound: theme-pick.tsx:18 (itself URL-only) and the same never-firing fallback (:594). `game.tsx` has 0 references. Product map said "Game · R". **U** |
| `/spectate` | "⚠️ No room code provided" without a code | 0 inbound anywhere; lobby/*.tsx have 0 references. Product map said "Lobby · R". **U** |

## Redirects

| route | measured behaviour |
|---|---|
| `/missions` | `<Redirect href="/">` :37 → Home |
| `/heatmap` | `<Redirect href="/">` :17 → Home |
| `/chip-store` | `<Redirect href="/shop">` :20 |
| `/battle-pass` | `<Redirect href="/">` :52 → Home; SideMenu entry commented out (:188); `battle_pass_enabled` has 0 client reads |
| `/simulate` | `if (!__DEV__) router.replace('/')` :32 — redirects in **production builds only**; in a dev build it renders, and Settings links to it when `caps_dev_unlocked` (settings.tsx:1026, gated :1243). Product map said "redirects to Home, always" |
| `/debug` | `allowed = __DEV__` :697 — redirects unless a **dev build**; the `caps_dev_unlocked` gesture does NOT open it (its Settings button is inside `__DEV__ &&`, settings.tsx:1244/1267). Product map said "unless dev-unlocked" |

## Flags that gate a screen — measured against the client code

| app_config key | value | read by client? |
|---|---|---|
| `mp_board_reveal_enabled` | true | yes — app/_layout.tsx:552 → multiplayer-game.tsx |
| `mp_server_adjudication_enabled` | true | yes — utils/serverAdjudication.ts:18 |
| `iap_enabled` | false | read by `/shop` via `isIapEnabled()`, but `loadIapEnabled()` is only called from `components/StarterOfferModal.tsx:90`, and `<StarterOfferModal` is mounted nowhere → the cached value is the default `false` regardless of the row. The file's own header ("Reversible WITHOUT a build: flip the iap_enabled row") is not true today. |
| `web_payments_enabled` | false | `utils/webPayments.ts` has no importer in app/ or components/ |
| `battle_pass_enabled`, `practice_mode_enabled`, `quick_poker_enabled`, `maintenance_mode` | — | 0 client reads |
| `premium_theme_enabled` | (absent from app_config) | read in contexts/PaintProvider.tsx:61; consumed by no route |
| client-side constants | `PRACTICE_LIVE_ENABLED=false` (constants/featureFlags.ts:28), `ECONOMY_FLAGS` (constants), `__DEV__` | not remote |

The full 40-key read/unread classification is in FINDINGS.md (class 6).
