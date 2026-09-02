# VAMOS CAPS LANDING-TRUTH — 2026-09-02

One claim on the landing page would become false the moment payments turn on. Fixed it, swept the
rest against `app_config`, added the disclaimer the category requires, and turned the page from an
explainer into an invitation. Branch `claude/vamos-caps-align-celebration-flppo0`. **Not merged, no
bump.** Only `public/landing.html` + `docs/splash-landing/` touched (the app is untouched).

## MAP (carried forward)
h152 rebranded the splash to the luxury felt + gilded serif and found all five grounds. This pass is
about the *words*: `public/landing.html` said "there's nothing to buy to keep playing" — true only
because `iap_enabled` is off. `app_config` holds five chip packages ($0.99 Starter → $19.99 Whale),
starter packs, and a $4.99 subscription. The day payments flip on, the page is lying, and it is
already published. Verified from the DB (#9 ground-truth), not the handoffs.

## The false claim — fixed first
**Old:** "Yes — completely free to play. You start with virtual chips and **there's nothing to buy to
keep playing**."
**New:** "Yes — **free to play, with optional in-app purchases**. You start with virtual chips and
earn more just by playing, so **you never have to pay** to keep going."
The category says *"you don't have to buy,"* never *"there is nothing to buy."* The new wording is the
phrasing that holds across the flag flip, and it keeps every true part (start with chips, earn by
playing, never required to pay).

## Other flag-dependent claims — swept the same way, one more found
Swept **every** factual sentence against `app_config` / code, not against what the page said. One more
would break on the same flag:
- **Q "Is it gambling?"** said *"no real money goes **in** and none comes out."* The "goes in" half
  breaks the instant `iap_enabled` is on — buying chips **is** real money going in. The load-bearing
  anti-gambling fact is that nothing comes **out**. **Rewrote:** "You play with virtual chips that
  have **no cash value** — no real-money prizes, and **nothing you win can be cashed out**." Holds
  with payments on or off. Backed by the DB: **no cash-out path exists** — the only `redeem_*`
  functions (`redeem_referral`, `redeem_starter_offer`) grant chips *in*; there is no
  withdraw/payout/cashout function.
- **Legal sub-line** "no cash, no payouts" → **"no cash prizes, no payouts"** (same reason: "no cash"
  could read as "no money involved," which IAP breaks; "no cash prizes" is the true, stable claim).
- Everything else (title/description "free to play", "virtual chips only", the web/no-download/no-
  signup claims) is flag-independent and stays.

## Disclaimer added | legal line unchanged
- **Added, verbatim:** "Success at social gaming does not imply future success at real-money
  gambling." — the standard social-casino line, previously missing.
- **Legal strong line kept verbatim:** "Free play · Virtual chips only · No real-money gambling · 18+".

## App vs page agreement
- **Legal strip agrees:** the page's strong line matches the app's home line verbatim
  (`app/(tabs)/index.tsx:1846` — "Free play | Virtual chips only | No real-money gambling | 18+"), and
  settings (`app/settings.tsx:1377`) carries the same promise.
- **One divergence, in the safe direction:** the new responsible-gaming disclaimer is **not** in the
  app (grep found no "does not imply / social gaming" anywhere). The page is now slightly *more*
  cautious than the app — the opposite of evasive. **Recommendation (not done — app is out of scope
  this sprint):** add the same disclaimer line to the app's legal surface when payments are being
  switched on.

## Headline — rule → promise (without planting a new false claim)
The old lead was the mechanic: "Four cards on every board. Every board plays at once…" The strategist
asked for the promise — *"one hand, four boards, four chances to win."*
**⚠️ That exact wording hardcodes a board count and would itself be a false claim:** board count is
**dynamic (2P=4, 3P=3, 4P=2)** — "four boards / four chances" is only true heads-up, false for 3–4
players. The app *already deleted* a "FOUR BOARDS" wordmark for this reason (index.tsx HOME-DECLUTTER).
So I kept the **intent** (promise, not mechanic) and dropped the number:
- **New headline (promise):** **"More than one way to win — every hand."** — true at every table size.
- **Mechanic kept as support underneath:** "Multi-board poker: four cards on every board, all played
  at once. Win the most boards, win the hand." ("four cards on every board" is always true; "every
  board" / "the most boards" state no count.)

## Multiplayer surfaced
A gilt pill under the mechanic: **"♥ Play online against real people — or practice against bots."**
Traceable: `quick_poker_enabled`, `sit_n_go_enabled`, `mp_server_adjudication_enabled`,
`practice_mode_enabled` all **true**. **Note (why not "instantly"):** only **8** devices have ever
played a hand (`hand_history` distinct device_id; the strategist's "25" is a broader ever-entered
measure). Promising instant *human* matches would break on an empty lobby — so the line surfaces the
mode (the retention lever) without a matchmaking guarantee the population can't honour, and names the
always-available bots as the honest fallback.

## Four stranger questions kept | still one CTA
All four kept (what / free / install / gambling). The MP pill is a non-interactive `<div>`, not a
link — **the page still has exactly one control**, the mint "Play now" CTA to `/`. No second CTA, no
signup wall, no email capture.

## CLAIM TRACE TABLE — every factual sentence → what makes it true
| # | Sentence on the page | What makes it true |
|---|---|---|
| 1 | "Multi-board poker … free in your browser" (title/desc) | game type; `app.json` web `output:single`; free-to-play faucet |
| 2 | "More than one way to win — every hand." | `getBoardCount` ≥ 2 every table (2P=4/3P=3/4P=2); each board won independently (`boardTally`) |
| 3 | "four cards on every board, all played at once. Win the most boards, win the hand." | `getCardsPerPlayer`=4 per board; all boards reveal together; hand = most boards (`boardTally`) |
| 4 | "Play online against real people — or practice against bots" | `app_config`: `quick_poker_enabled`, `sit_n_go_enabled`, `mp_server_adjudication_enabled`, `practice_mode_enabled` = true |
| 5 | "Play now · Free · in your browser · no sign-up" | `app.json` web build; anonymous auth (`utils/auth`); play-grant faucet (no pay required) |
| 6 | "Tap and you're dealt in. Nothing to download, no account to make." | web build (no download); anonymous sign-in (no account) |
| 7 | Q1 "CAPS is multi-board poker … take the most boards to win" | same as #3 (`gameConfig`) |
| 8 | Q2 "free to play, with optional in-app purchases … never have to pay" | `starting_chips`=2000; `play_grant_per_hand`=80; `chip_store_packages` (5, $0.99–$19.99) = the optional IAP; faucet = never required |
| 9 | Q3 "runs in your browser … no app store, no download" | `app.json` web `output:single` |
| 10 | Q4 "virtual chips … no cash value … nothing you win can be cashed out. 18+" | economy is virtual (`chip_transactions`); **no cash-out RPC exists** (only inbound `redeem_*`); 18+ policy |
| 11 | Legal "Free play · Virtual chips only · No real-money gambling · 18+" | verbatim = app `index.tsx:1846` |
| 12 | Legal "no cash prizes, no payouts, no purchase required to play" | no payout path (DB); faucet = playable without buying |
| 13 | Disclaimer "Success at social gaming does not imply future success at real-money gambling." | standard responsible-gaming statement (not a data claim) |

**Anything untraceable → removed:** the one untraceable/false sentence ("nothing to buy to keep
playing") is gone. Every sentence now on the page traces to a row above.

## PNGs 320/393/430 committed | git show
`docs/splash-landing/landing-320.png`, `landing-393.png`, `landing-430.png` (re-rendered this pass),
`landing-loop.json`.
```
git show HEAD:public/landing.html | grep -n "optional in-app\|more than one way\|does not imply\|cashed out"
git show --stat HEAD
```

## Contrast / 44pt / overflow | canary first
Canary ran first: **CTA fill = mint `rgb(79,214,168)`**, brass edge, dark label — not gold. Passes.
- 44pt: CTA 84px tall, the only control.
- Overflow: none at 320 / 393 / 430 (`overflowX:false` ×3).
- Contrast (WCAG, sampled on felt `#0B2318`): promise white **14.5**, gold **7.25**, mechanic **6.5**,
  CTA label on mint **10.4**, question heading **7.9**, legal faint **6.9** — all ≥ AA, most ≥ AAA.

## No overstatement, no fake proof
No player counts, no "thousands", no invented social proof (only 8 devices have ever played a hand).
The MP line names a real, enabled mode without promising opponents on tap.

## Not merged, no bump
Branch only; version 2.7.0 / build 513 untouched; the app, economy, reset, security, and every flag
untouched. Only `public/landing.html` changed.
