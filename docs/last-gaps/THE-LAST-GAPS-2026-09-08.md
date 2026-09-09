# The last gaps — the store listing, a second hollow sweep, and the filename rule

**Date** 2026-09-08 · App Store Connect app `6760429619` · every number below was read, not recalled.

---

## §1 · The App Store listing

### It is not stale. It is blank.

The brief expected stale metadata describing an older product. That is not what is there. Read
today through the App Store Connect REST API, **every text field a stranger would read is `null`**,
and there are **zero screenshots**.

| Field | Value in App Store Connect |
|---|---|
| App name | `CAPS - Card game` |
| Subtitle | **null** |
| Description | **null** |
| Keywords | **null** |
| Promotional text | **null** |
| What's New | **null** |
| Support URL | **null** |
| Marketing URL | **null** |
| Privacy policy URL | **null** |
| Privacy policy text · privacy choices URL | **null** · **null** |
| Primary category · secondary category | **null** · **null** |
| Age rating declaration | **every field null**, `ageRatingOverride: NONE` |
| `appStoreAgeRating` · `kidsAgeBand` | **null** · **null** |
| Screenshots, all device sizes | **0** |
| Localizations | one, `en-US` |
| Version | **1.0**, `PREPARE_FOR_SUBMISSION`, created **2026-03-11** |
| Bundle · SKU · primary locale | `com.capspoker.app` · `CAPS1234` · `en-US` |

⚠️ **These are findings, not failed reads, and the difference is the whole discipline here.** Every
call that produced a row above returned **HTTP 200**. Apple was asked and Apple answered "nothing".

Two calls returned **404** and are therefore **unknowns, not zeros**:

| Endpoint | Status | What that means |
|---|---|---|
| `/v1/appDataUsages?filter[app]=…` | **404** | The privacy nutrition label was NOT read. I do not know what it says. |
| `/v1/apps/{id}/appEncryptionDeclarations` | **404** | Export-compliance declarations were NOT read here. |

`endUserLicenseAgreement` returned 200 with no data: no custom EULA, which is normal.

### Three consequences worth stating plainly

1. **The app cannot be submitted today even if Roye wanted to.** Apple requires a description,
   a support URL, a privacy policy URL, a category, an answered age-rating questionnaire and at
   least one screenshot. All six are missing.
2. **The version record still says 1.0, created 2026-03-11.** The product is 2.7.0, build 515.
3. **The listing name is `CAPS - Card game`.** Every other surface — the icon, the splash, the
   landing page, the app itself, the explainer's end card — says **CAPS POKER**.

### §1.3 · The age rating is not 17+ and not 12+. It is unset.

`gamblingSimulated: null`, `gambling: null`, `lootBox: null`, `contests: null`, override `NONE`,
`appStoreAgeRating: null`. **The questionnaire has never been answered at all.**

That matters more than it looks. Apple moved Simulated Gambling to the **Frequent/Intense** band,
which drives a rating of **17+/18+**. CAPS is a poker game with chips, boards and a shop. The
honest answer to `gamblingSimulated` is Frequent/Intense, and the landing page and the app already
carry the matching promise: *"Free play · Virtual chips only · No real-money gambling · 18+"*.

⚠️ So the recommendation is not "raise the rating". It is **answer the questionnaire honestly and
accept the 17+/18+ that follows**, and expect it, rather than being surprised by it at submission.

### §1.5 · The store screenshot set exists, and it is NOT provably current

**Where:** `docs/product-map/store/` — seven PNGs at **1290×2796** (iPhone 6.7"), committed in
`de6af91` on **2026-09-03**.

| File | What it shows | Fit for a store listing |
|---|---|---|
| `01-home.png` | Home, current identity, mint Play Online, 3 tabs | good |
| `02-play.png` | Play tab, five modes | good |
| `03-shop.png` | ⚠️ **"Shop is empty right now." + a Retry button** | **no** |
| `04-achievements.png` | ⚠️ **"No achievements yet / No achievements found"** | **no** |
| `05-game-placement.png` | Real placement, four boards | good |
| `06-game-reveal.png` | Real reveal with equity | good |
| `07-results.png` | YOU WIN, 3—1, board breakdown | good |

⚠️ **Two of the seven advertise emptiness.** A store screenshot of an empty shop and a screenshot
of "no achievements found" tell a stranger the product has nothing in it.

**Current for 515? No — and the answer comes from the diff, not from the folder date.** Since
`de6af91`, eleven commits touched `app/`, `components/` or `constants/`, and among the files they
changed are `app/(tabs)/index.tsx`, `app/(tabs)/play.tsx`, `app/game.tsx`, `app/results.tsx`,
`components/BoardReveal.tsx`, `components/BoardResultCard.tsx`, `components/PlayerHand.tsx`,
`components/BoardArrangement.tsx`, `components/CompleteBanner.tsx` and
`components/DealMeInButton.tsx` — **the render path of five of the seven shots**.

They may still look identical. That is exactly the point: **a folder dated four days ago is a
claim, not evidence.** Regenerate and look before any of it goes to Apple.

**One size only, and that is a gap:** 1290×2796 is the 6.7" set. Apple's current primary iPhone
size is 6.9" (1320×2868). `supportsTablet: false`, so no iPad set is needed.

### Recommended copy — DRAFTED, NOT APPLIED

⚠️ **Nothing was changed and nothing was submitted.** `tools/asc/store_listing.rb` performs GET
requests only; there is no PATCH or POST anywhere in it.

**Name (30 max)** — `CAPS Poker` *(24 chars incl. space; matches every other surface)*

**Subtitle (30 max)** — `Multi-board poker, free` *(23)*

**Keywords (100 max, comma-separated, no spaces, no repeats of the name)**
```
multiboard,omaha,cards,boards,tables,strategy,offline,bots,friends,freeplay,chips,casual
```
*(91 characters.)*

**Promotional text (170 max)**
```
Four cards on every board. Every board plays at once. Win the most boards, win the hand. Free play with virtual chips — no real money, ever.
```

**Description**
```
CAPS is multi-board poker.

You are not dealt four cards. You are dealt four cards on EVERY board — and you decide which card
goes where. That decision is the game.

Every board is played at once, under Omaha rules. Win the most boards and you win the hand. Win
them all and that's a COMPLETE.

HOW A HAND WORKS
• You get four cards on every board, not four cards in total.
• You choose which cards go where.
• Every board plays at the same time. Most boards wins.
• The number of boards changes with the table size, so no two tables play the same.

WHAT YOU GET
• Practice against bots — instantly, no waiting.
• Public and private tables against real people.
• Live win odds and outs as each board reveals.
• Hand history and a card-by-card replay of every hand you have played.
• Stats, achievements and a global leaderboard.

FREE PLAY, VIRTUAL CHIPS ONLY
CAPS is a poker game for entertainment. There is no real-money gambling, no cash prizes, no
payouts, and nothing you win can be cashed out. Success at social gaming does not imply future
success at real-money gambling. 18+.

No sign-up wall. Open it and you are dealt in.
```

**What's New (2.7.0)**
```
• A new look for the table: deeper felt, clearer cards, a calmer results screen.
• Hebrew throughout the game and reveal screens.
• Faster, steadier multiplayer tables.
• Many fixes to hand history, invites and the shop.
```

**Support URL** — needs a real page that answers a player. `https://caps.ftable.co.il/landing.html`
is live and honest but is marketing, not support. ⚠️ **Recommend a genuine support page before
submission** — Apple rejects a support URL that only sells.

**Privacy policy URL** — `https://caps.ftable.co.il/privacy.html` is live and already has an
explicit rewrite in the shipped config.

**Category** — Primary **Games › Card**. Secondary **Games › Casino** is the honest second, and it
is worth knowing that it invites the gambling-adjacent review lens the age rating already implies.

**Age rating** — answer `gamblingSimulated` as **Frequent/Intense** and take the 17+/18+.

**Screenshots** — regenerate all seven from build 515, at **1320×2868**, and **replace the shop and
achievements shots with populated screens or with two more gameplay moments.**

---

## §2 · The second hollow-route sweep

`tools/hollow-sweep.mjs`. The route list is derived from `app/`, never typed — **33 routes**, and
all 33 were walked and screenshotted into `docs/hollow-sweep-2026-09-08/`.

⚠️ **BOUNDARY, STATED NOT HIDDEN.** The sweep runs with `supabase.co` and `ftable.co.il` aborted.
Two reasons, both deliberate: a hollow promise is rendered by the CLIENT (the battle pass's
countdown and its 5,000-chip button needed no server), and visiting the real backend would mint a
new device and a 2,000-chip grant days after a purge whose whole purpose was clean numbers. **So
these are no-network states.** Where an online cold state would differ, it is settled below from
the source and the database, and said out loud.

### The four probes, defined before looking

`countdown` · `price` · `claim` · `deadend`, as regexes over the text a visitor can actually read.

### What the sweep found

**Nothing of the battle pass's size. Two things of its shape.**

#### ⚠️ FINDING 1 — `/gameover` tells a player with money that they have run out

Typed by someone who has never played:

```
GAME OVER
Not enough chips to continue
FINAL BALANCE   2,000
[PLAY AGAIN]  [MAIN MENU]
```

The claim and the number that disproves it are on the same screen. Confirmed in the source rather
than inferred from one render: `app/gameover.tsx:117-122` renders the `GAME OVER` header and the
string `Not enough chips to continue` **unconditionally**, then prints `ChipsDisplay amount={chips}`
underneath. **There is no guard on `chips === 0`.**

This is the battle-pass class exactly: reachable by URL, gated by nothing, stating something the
product's own state contradicts.

**Recommended fix (not applied — `app/` is outside this sprint's edit scope):** render the screen
only when `chips` is actually below the buy-in, and otherwise redirect to Home the way `/missions`
and `/heatmap` do. One conditional.

**One thing I could NOT prove and will not claim:** the designed rescue is
`claim_emergency_chips` (200 a day, `app/gameover.tsx:92`). It did not appear in this run because
the RPC could not be called with the backend aborted. **I do not know whether it renders online.**

#### ⚠️ FINDING 2 — `/multiplayer-game` draws a live table for a room that does not exist

```
✕   ALL CARDS PLACED!   💰 1,925
2P GUEST · Seat 1
YOUR HAND 0        All cards placed!
👆 Tap a card from your hand, then tap a board to place it
WIN ALL → +0            [Cancel]  [✓ READY]
```

A seat, a balance, an instruction and a green **READY** button, with no room behind any of it.
Compare the seated public table at `/lobby/table`, which handles the same situation honestly:
*"Online multiplayer is unavailable right now."* One screen admits it; the other pretends.

**Recommended fix:** show the same honest message when there is no room, or bounce to `/lobby`.

#### The cold-visit states — one hazard, one contradiction, one fabrication

| Route | Cold state | Verdict |
|---|---|---|
| `/game` | ⚠️ **Deals a real hand and takes the 75-chip buy-in immediately.** Measured: 2,000 → 1,925 with no confirmation. `app/game.tsx:638-640`, `getMatchCost(...)`, not practice. | **Hazard, not hollow.** A typed URL spends the player's chips. |
| `/lobby` | Six slots reading *"Opening a table…"*, under *"Public tables · auto-start when full"* and *"A real person joins here"* | **Contradiction.** 0 rooms have ever reached `playing`. The lobby promises what its own seated table denies. |
| `/club/DEMO` | A complete club — code, share button, three "Start ›" table types, a MINI-LEAGUE panel — **for a code that does not exist** | **Fabrication.** Any string becomes a club. |
| `/results` | *"This hand is no longer available."* | **Honest.** |
| `/replay` | *"No hand selected — open a hand from your history."* | **Honest.** |
| `/spectate` | *"⚠️ No room code provided"* | **Honest.** |
| `/invite/DEMO` | *"This invite link does not contain a valid code."* | **Honest.** |
| `/shop`, `/chip-store` | *"Shop is empty right now."* (`/chip-store` redirects to `/shop`) | **Honest.** |
| `/achievements`, `/leaderboard`, `/stats`, `/rank`, `/coaching`, `/hand-history`, `/cups` | *"No … yet"* + a Play Now route out | **Honest empty states.** |
| `/battle-pass`, `/missions`, `/heatmap` | redirect to Home | **Closed, as intended.** |
| `/simulate`, `/debug` | `__DEV__`-gated, redirect to Home in production | **Correctly gated.** |

**Would any of them confuse rather than inform?** Three: `/gameover` (states a falsehood),
`/multiplayer-game` (offers a control that cannot work), and `/club/DEMO` (invents an entity). The
rest either tell the truth or bounce.

### Two things checked and cleared, recorded so nobody re-raises them

- **`StarterOfferModal`** — a $2.99, 10,000-chip offer with a 7-day countdown and a RevenueCat
  purchase path, **imported at `app/(tabs)/index.tsx:85` and never rendered.** `grep '<StarterOfferModal'`
  across `app/` returns nothing. It is a dead import, not a live offer. Worth removing for bundle
  size; it promises nobody anything today.
- **`variant="gold"` on the gameover PLAY AGAIN button** — looked like a winner-cue violation, and
  is not. `components/Button.tsx:190-194` swapped that variant's fill **gold → mint** in the theme
  sweep, and the render confirms it: the button is mint. ⚠️ **A variant named `gold` that paints
  mint is the §3 rule in miniature**, which is why it is now cited in the rule itself.

---

## §3 · The filename class, closed

### The rule, now in `CLAUDE.md` under Hard rules

> ⚠️ **A FILENAME IS NOT EVIDENCE. Verify by CONTENT, and verify at the place that actually SHIPS.**

with the six repeats it was earned by: Hebrew screenshots under two names · the icon overwritten
six times in place · a stale bundle under an unchanged hash · three different files called
`caps-explainer-FINAL.mp4` · the catch-all 404 fixed in `vercel.json` when production reads
`dist/vercel.json` · and `variant="gold"` on a button that paints mint.

### Are there siblings? Yes — one, found deliberately.

The brief's point was that the vercel case was found by accident. So the hunt was structured rather
than opportunistic: enumerate every file the checks read, then ask for each whether production,
CI or the bundler reads that same copy.

#### ⚠️ SIBLING — the visual-QA baselines, and it is worse than the record said

`CLAUDE.md` printed this recipe:

```
npm run visual-qa:update
git add tests/visual/baselines/
```

**`tests/visual/baselines/` does not exist.** Not empty, as the record claimed since 2026-08-09 —
**absent**. So the `git add` fails outright and the recipe cannot run. And what
`--update-snapshots` does refresh is Playwright's snapshots, which the CI gate never compares: CI
runs `npx backstop test` against **`backstop_data/bitmaps_reference/`** (12 files, present).

Same shape as the 404: **a documented command aimed at a file the thing that ships never reads.**

**Fixed in the record**, with the correct recipe now a runnable block, and pinned:
`tests/claude-md-paths.test.ts` asserts that every path `CLAUDE.md` hands to `git add` inside a
fenced block exists on disk.

⚠️ **The first version of that guard failed on the sentence documenting the broken recipe** —
prose quoting `git add tests/visual/baselines/` while explaining that the path is gone. It was
narrowed to fenced blocks only. This project already wrote down what the blunt version costs: *a
guard that fails correct content teaches the next person to delete the guard.*

#### Ruled out, and why — a hunt that only finds is not a hunt

| Candidate | Verdict |
|---|---|
| `app.json` vs a committed `ios/` or `android/` | **Not a sibling.** Both directories are untracked (`git ls-files ios` → 0) and regenerated by `npx expo prebuild --clean` on every build, so `app.json` **is** the file that ships. |
| The patched `dist/index.html` (type="module", error handler, dvh viewport) | **Already covered.** `tests/verify-board-counts.mjs:47-49` reads `dist/index.html` and hard-stops if it is unpatched. |
| The un-suffixed `public/shots/game-boards.webp` / `game-reveal.webp` | **No longer a sibling.** Live `landing.html` is now the swapping version; the un-suffixed names appear only inside a comment, in no `src`. Verified against the live page. |
| Jest reading `app/results.tsx`, `utils/i18n.ts` | **Not siblings.** Both are bundled, so the file read is the file shipped. |

---

## Production unchanged

| | |
|---|---|
| App Store metadata | **untouched.** GET only; no PATCH, no POST, nothing submitted. |
| Age rating / privacy answers | **untouched.** |
| TestFlight public link | **still disabled.** 515 **not** submitted for Beta App Review. |
| Economy | **untouched.** The sweep ran with the backend aborted, so no device was created and no chip was granted or spent in the database. |
| Flags · winner cue · card sizes · the 83px arc | **untouched.** |
| Routes | **none deleted, none redirected.** Two fixes recommended and not applied. |
| Edge Functions | **none deployed** (`verify_jwt` untouched). |
| `game_rooms` / `room_players` | **not hand-edited.** |
| Files changed | `CLAUDE.md`, `tests/`, `tools/`, `docs/`, and one read-only workflow action. |

## Suite

Full suite green. `tests/claude-md-paths.test.ts` is new (5 tests).

## Where to look

```bash
git show origin/main:docs/last-gaps/THE-LAST-GAPS-2026-09-08.md
git show HEAD:docs/hollow-sweep-2026-09-08/sweep.json | head -60
git show HEAD:docs/hollow-sweep-2026-09-08/gameover.png > /tmp/go.png && open /tmp/go.png
git show HEAD:docs/hollow-sweep-2026-09-08/multiplayer-game.png > /tmp/mp.png && open /tmp/mp.png
git show HEAD:docs/hollow-sweep-2026-09-08/club-DEMO.png > /tmp/club.png && open /tmp/club.png
git show HEAD:docs/product-map/store/03-shop.png > /tmp/shop.png && open /tmp/shop.png
node tools/hollow-sweep.mjs                    # re-walk all 33 routes
npx jest tests/claude-md-paths.test.ts
```

The listing read is reproducible without any write:
**Actions → Manage TestFlight → `store-listing`** (`tools/asc/store_listing.rb`).
