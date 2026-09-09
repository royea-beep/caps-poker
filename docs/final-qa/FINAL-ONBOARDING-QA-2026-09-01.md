# FINAL-ONBOARDING-QA — 2026-09-01 — walk in as a stranger, verify every promise

Last gate before testers. main @ `baff424` (confirmed on the remote ref). Verified from the app and
the DB, not the handoffs. **Verification only — no code changed** (docs/ only). One instrument
failure caught (below) — the lesson held.

## 1 — FIRST SESSION as a stranger (513 bundle, rebuilt fresh from baff424; screenshots in docs/final-qa/)
A brand-new device, no state, walked end to end:
- **First run → straight into a Practice game** with an in-game tutorial. Top-left pill reads
  **"🤖 Practice · no chips"**; a coach-mark says **"These are your cards. Place 4 on each board."**
  PLACE 12 CARDS · 3 boards (3-player) · YOUR HAND 12 · ⚡ Auto-Place ALL · Cancel/Confirm chips.
- **Auto-Place → Confirm → reveal**: each board shows both bots' hands with names (BOT 1 THREE OF A
  KIND in green, BOT 2 ONE PAIR in red), the winning cards gold-highlighted, a coach-mark
  "Green = win, Red = loss. Watch for COMPLETE bonus!", and the outcome **❌ YOU LOSE —
  "Three of a Kind beats One Pair"** with "Tap to continue →". (The results-summary hero + "Hand
  details" toggle + mint DEAL ME IN were verified in SHIP-513.)
- **Home** (behind the tutorial): luxury CAPS POKER masthead + ROYAL FLUSH fan, **Play Online** and
  **Practice vs bots** chips, tagline "Four cards on every board. Every board plays at once. Win the
  most boards, win the hand.", "🎁 Claim daily bonus · Day 1", and **"Free play | Virtual chips only |
  No real-money · 18+"**. Side menu: Player / 💰 2,000 chips / Friends / Battle Pass / Coaching /
  Tutorial / Language: English / Sign In. Bottom bar: **Home · Play · Profile** (3 tabs).

**Read as a person:** a stranger knows what the game is and what to press within seconds — the
Practice pill, the "Place 4 on each board" coach-mark, and the one-line rule ("Win the most boards")
carry it. Nothing truncated, contradictory, or overpromising was found on 513. (Two apparent
overpromises — a static "+50 daily reward" and a "/lobby/join → Enter host IP" screen — turned out to
be **stale-bundle artifacts**, see the instrument-failure note; both are gone in 513.)

**New device → 2,000, ledgered, gap 0 — PROVEN in the DB** (stronger than one QA device): 12 real
post-reset `starting_grant` rows are each **2000**; across all 501 devices **min balance = 2000, max
2350, 0 negatives** (487 exactly at 2000, 14 moved up via the play faucet). The ledger IS the balance
(`device_identity` has no balance column; `chip_transactions` sum is authoritative), so gap = 0 by
construction. `hand_net` ledger sum = **0** (zero-sum). 513's offline store default is also 2000 (no
1,000 flash). Roye's stat line reproduced exactly: 501 devices · 6 bindings · 74 hands · 0 purchases ·
14 moved off 2000.

**Practice vs real — obvious:** the game pill "🤖 Practice · no chips" and the home line "Free play |
Virtual chips only | No real-money". **PASS.**

**All routes reachable, nothing stranded:** 3 tabs (Home/Play/Profile); a typed bad URL
(`/lobby/join`) renders a clean **"Unmatched Route — Page could not be found — Go back"**, not a crash
(the old "Enter host IP" screen is gone in 513). **PASS.**

**Widths:** 393 walked in full; 320 home checked (no truncation). 375/430 not re-walked this sprint —
the 513 screens were rendered at 320/393 in SHIP-513 and are clean; **web engine = Chromium only**
(WebKit not installed in the container — stated, not claimed).

## 2 — COMMITMENTS, verified independently (app + DB; live anon attacks re-run)
**SECURITY — re-attacked as anon (anon key REST):**
| attack | result | verdict |
|---|---|---|
| anon INSERT `chip_transactions` (mint) | HTTP 401 "permission denied for table" | **PASS** |
| anon INSERT / SELECT `leaderboard`, SELECT ledger | HTTP 401 permission denied | **PASS** |
| `submit_score` mint (total_chips 999,999,999) | capped to **2000** display, **0 ledger rows written** | **PASS** (can't mint spendable) |
| `record_reward` cap | deployed body `LEAST(amount, 2000)` + 5000/day | **PASS** |
| room-kill (`cleanup_expired_rooms`) as anon | HTTP 401 "permission denied for function" | **PASS** (revoked) |
| table actions (`finish_table`) | deployed body returns `not_authorized` for a non-participant when a fresh seat exists | **PASS** by code; live active-room kill = **COULD NOT** (no live room to target) |
| ELO ladder uuid leak (`get_elo_leaderboard`) | returns name/elo/peak/games/win_rate — **no uuid/device_id** | **PASS** |
| forged payment (`earn_chips iap_starter_pack`) | `ok:false, purchase_not_verified` (real-money only via `verify-purchase`) | **PASS** |

**ECONOMY:** faucet rewards PLAY not presence — `daily_login` = **0 chips**, and `earn_chips` **retires
`daily_login`+`daily_reward` to 0** (all daily reward now flows through the ledgered claim path;
14 devices claimed today). The four play-faucet behaviour numbers: **`play_grant_per_hand`=80,
`play_grant_practice_pct`=50, `play_grant_daily_cap`=800, `hand_rake_pct`=5**. Daily caps hold
(`earn_chips` 5000/day, `record_hand_net` 20000/day, play_grant 800/day). Zero-chip guarantee: every
credit is `GREATEST(0,…)` (no negative balance possible) and min balance is 2000; practice never
wagers (`hand_net` sum = 0, zero-sum); real hands settle zero-sum (clamped ±10000). **PASS.**

**RULES:** `getBoardCount` 2P=4 / 3P=3 / 4P=2 (the walk's 3-player game rendered 3 boards);
`boardTally` derives `tied = total − won − lost` (sums to the board count by construction), read by
results/history/replay/share; `record_hand_net` is the single ledger writer, **idempotent per hand_id**
(`ON CONFLICT DO NOTHING`); one ELO writer. Rule suites green: gameLogic/handOutcome/handEvaluator/
handTiebreak = **93 tests pass**. **PASS.**

**VISUAL:** winner cue `#FFD700` 3px on WON only (Card.tsx; "gold means only won"); cue vs felt
greyscale luminance ratio **7.65** (separates); card geometry measured/unchanged; the 83px arc
(measured `HEADER_H`) renders with no overlap in the game reveal; `goldButtonHits = 0` (SHIP-513
fixture runtime + live content delta — results CTA is the mint ChipButton, coaching retinted mint).
**PASS.**

**FLAGS:** payments **off** (`iap_enabled=false`); missions **inactive** (no nav link to `/missions`,
profile entry hidden); **`KILL_Board = true`** (hardcoded in utils/animationKill.ts); **`verify_jwt`
ON** for the money path (`verify-purchase` edge function = true). **PASS.**

## 3 — HONEST GAPS
- **NEVER VERIFIED (stated plainly):** native iOS rendering on a device (the felt gradient, beam,
  LuxuryBackdrop, gilded Georgia masthead, chip bevel — 513 is the first build they reach iOS);
  multiplayer with two real clients; MP under load. The container's browser **cannot reach the live
  backend** (the agent proxy closes browser tunnels mid-handshake ~6s), so all rendering was on a
  locally-served fresh 513 bundle with the economy proven from the DB instead.
- **What a tester will hit (known):** MP is unproven end-to-end (2-client + load); the native-only
  luxury look is unseen on iOS; earlier-flagged opens — MP label at largest Dynamic Type, the lobby
  practice row, a tied-board hand on device, REMATCH end-to-end.
- **Instrument failure this sprint: 1.** The committed `web-dist/` is a **stale June-15 artifact**
  (c29c1a8), not 513 — my first local walk ran on it and surfaced two phantom "defects" (a static
  "+50 daily reward" and a "/lobby/join → Enter host IP" screen). Caught by checking the bundle
  markers against 513; both are gone in the real 513. Housekeeping candidate: git-rm/ignore `web-dist/`
  (Vercel rebuilds fresh, so it is harmless to production but a local-testing trap). `DealMeInButton`
  remains unused dead code (harmless).

## VERDICT
**Ready for testers.** The stranger's first session works end to end and reads clearly; the economy,
security, rules, visual and flag commitments all verify from ground truth. The edge of proof is the
**device** and **real multiplayer** — invite testers knowing those are exactly what needs eyes, and
that the native-only luxury renders will be seen on iOS for the first time on 513.
Production unchanged: no economy / reset / security / art / nav / flag touched; no merge, no bump.
