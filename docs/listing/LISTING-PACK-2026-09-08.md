# App Store listing pack — CAPS Poker

**For Roye to paste into App Store Connect.** App `6760429619` · build 515 · version 2.7.0.

> ## ⚠️ UPDATED 2026-09-08 — MOST OF THIS IS NOW LIVE ON APPLE'S SIDE
>
> The line that used to sit here said "Nothing in this document has been written to App Store
> Connect. Every field below is still `null` on Apple's side." **That is no longer true**, and a
> document asserting a state the product left behind is the defect this project keeps paying for.
>
> **WRITTEN AND READ BACK:** description · subtitle · promotional text · keywords · privacy policy
> URL · support URL · category (Games / Card / Strategy) · the age-rating questionnaire (Apple
> computed **17+**). Record: `docs/listing/WRITE-THE-LISTING-2026-09-08.md`.
> **NOT WRITTEN:** What's New (correct — the field is for updates and this is version 1.0) and
> marketing URL (optional).
>
> ⚠️ **THIS FILE IS NOW LOAD-BEARING, NOT A SHEET.** `tools/asc/listing_copy.rb` PARSES it at
> runtime and hands the strings straight to a PATCH against the live listing. Editing the copy here
> changes what Apple is sent. `tests/listing-copy.test.ts` pins the parse.

---

## 1 · Description

⚠️ **Checked line by line against the shipped app.** No battle pass (the route redirects Home). No
missions (retired). No purchases with money (payments are off, 0 purchases ever). And the
multiplayer sentence is deliberately weaker than the marketing instinct wants, because **no room
has ever reached `playing`** — so the copy says tables *can* be opened and shared, never that
opponents are waiting.

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
• Instant tables against bots — no waiting, no setup.
• Private tables you can open and share with a friend by code.
• Live win odds and outs as each board reveals.
• Hand history, and a card-by-card replay of every hand you have played.
• Stats, achievements, a global leaderboard, and a shop you spend earned chips in.

FREE PLAY, VIRTUAL CHIPS ONLY
CAPS is a poker game for entertainment. There is no real-money gambling, no cash prizes, no
payouts, and nothing you win can be cashed out. Chips are earned by playing and can only be spent
inside the game. Success at social gaming does not imply future success at real-money gambling. 18+.

No sign-up wall. Open it and you are dealt in.
```

**Name (30 max):** `CAPS Poker` *(10 characters)*

⚠️ **The listing name was `CAPS - Card game` and everything else in the product says CAPS POKER —
the icon, the home masthead, the landing page.** Roye approved the change on 2026-09-08 on
consistency grounds, with the honest caveat that there is no search data behind it. A product
called two things is the same class of defect as a file named for content it does not have.

**Subtitle (30 max):** `Multi-board poker, free` *(23 characters)*

**Promotional text (170 max):**
```
Four cards on every board. Every board plays at once. Win the most boards, win the hand. Free play with virtual chips — no real money, ever.
```

**Keywords (100 max, comma-separated, no spaces):**
```
multiboard,omaha,cards,boards,tables,strategy,offline,bots,friends,freeplay,chips,casual
```
*(91 characters. Deliberately no "casino", "poker" — the app name already carries poker, and
Apple does not index the name twice.)*

**What's New (2.7.0):**
```
• A new look for the table: deeper felt, clearer cards, a calmer results screen.
• Hebrew throughout the game and reveal screens.
• Faster, steadier multiplayer tables.
• Many fixes to hand history, invites and the shop.
```

---

## 2 · Support URL

⚠️ **Apple's field requires a URL, not a mailto.** App Store Connect rejects a `mailto:` in the
support URL field, and the App Review Guidelines require a support page a user can open.

**Two options, both honest:**

| | |
|---|---|
| **Fastest** | `https://caps.ftable.co.il/landing.html` — live now, but it is **marketing**. Apple has rejected support URLs that only sell. **Not recommended alone.** |
| **Recommended** | A small support page at `https://caps.ftable.co.il/support.html` — contact address, how to report a bug, how to ask for deletion, the fact that chips have no cash value. ⚠️ **This page does not exist yet.** It is about twenty minutes of work and is not in this sprint's scope; say the word and it gets built the same way the privacy page was. |

**The contact address on either page:** `caps@ftable.co.il`

⚠️ **One inconsistency to settle first.** The in-app account-deletion failure message names
`royearguan@gmail.com`, while the brief specifies `caps@ftable.co.il` and the new privacy page uses
it. Two addresses for one purpose is the kind of thing a reviewer notices. Pick one and I will
align the app string to it.

---

## 3 · Privacy Policy URL

```
https://caps.ftable.co.il/privacy.html
```

**Live, English, rewritten from the code on 2026-09-08.** It replaces a Hebrew-only page dated
April that promised working account deletion, described Apple processing payments, claimed no
third-party sharing, and said 12+.

⚠️ **What it now discloses, all verified in the code or the database:**

- anonymous device identity, with Google sign-in explicitly optional;
- what is stored: chips, hands, achievements, streaks, leaderboard standing, analytics events, a
  push token if allowed;
- **that a bug report carries a breadcrumb trail, the last 20 console lines, the device identifier,
  the build number and a screenshot** — so a player knows they are sending more than they typed;
- that chips cannot be bought with money and cannot be converted into money;
- **seven third parties**, each present in the code: Supabase, Vercel, Google, Telegram, Anthropic,
  OpenAI, Expo;
- **deletion is by email and handled by hand**, because the in-app control is disabled. It does not
  promise the automated deletion the revoked RPC cannot perform, and it does not promise an export.

---

## 4 · Category

| | Choice | Why |
|---|---|---|
| **Primary** | **Games › Card** | It is a card game. This is where a person looking for one browses. |
| **Secondary** | **Games › Strategy** | The whole game is the placement decision. It reaches the players most likely to stay. |

⚠️ **Not Casino.** Casino invites the gambling review lens — heavier scrutiny, region restrictions,
and questions about real-money conversion that CAPS does not need to answer. The age rating already
declares simulated gambling honestly; the category does not need to advertise it as well.

---

## 5 · Age rating

⚠️ **The task is to ANSWER the questionnaire, not to raise a number.** It has never been answered:
`gamblingSimulated` is `null`, `gambling` is `null`, the override is `NONE`, and
`appStoreAgeRating` is `null`. The app is not rated 12+ or 17+ — it is **unrated**, and unrated
cannot be submitted.

**In App Store Connect: App Information → Age Rating → Edit.** It is a list of content questions.

| Question | Answer |
|---|---|
| **Simulated Gambling** | ⚠️ **Frequent/Intense** — this is the one that matters |
| Contests | None |
| Gambling (real money) | **No** |
| Alcohol, Tobacco, or Drug Use or References | None |
| Violence (all rows), Sexual Content, Horror, Profanity, Mature Themes | None |
| Unrestricted Web Access | **No** |
| Made for Kids | **No** |

**Result: 17+.** That is expected, not a problem — it is the correct rating for a poker game with
simulated gambling, and it matches the app's own "18+" line on the home screen, the landing page and
the privacy policy.

---

## 6 · Screenshots

**Files:** `docs/product-map/store-515/` — nine screens at **1320×2868** (6.9″, Apple's primary) and
**1290×2796** (6.7″). `supportsTablet` is false, so no iPad set is required.

**Upload these seven, in this order:**

| # | File | What it sells |
|---|---|---|
| 1 | `01-home-….png` | the identity — gold wordmark, royal flush, one obvious button |
| 2 | `05-game-placement-….png` | the mechanic — four boards, sixteen cards to place |
| 3 | `06-game-reveal-….png` | the tension — live win odds as a board reveals |
| 4 | `07-results-….png` | the payoff — YOU WIN, board by board, a real tie included |
| 5 | `03-shop-….png` | depth — ten real items bought with earned chips |
| 6 | `09-hand-history-….png` | it remembers — real hands, real ranks, real deltas |
| 7 | `02-play-….png` | the modes |

**Spares, not recommended for the seven:** `04-achievements` (a grid of mostly locked icons) and
`08-profile` (sparse below the stats).

⚠️ **These are web-export renders, not iOS device captures.** Fonts, emoji and safe-area insets
differ slightly from a real iPhone. One visible consequence: the crossed-swords emoji beside
"Challenge a Friend" on the home shot renders monochrome here and in colour on iOS. If shot 1 must
be perfect, take that one on the phone.

---

## What is still NOT ready to submit

⚠️ **Filling these five fields does not make the app submittable.** A real submission also needs:

1. **A build attached to the version record.** The version is still **1.0, created 2026-03-11**,
   while the product is 2.7.0 build 515. The version string has to be created and 515 selected.
2. **Export compliance answered for the version.** Build 515 has it answered for TestFlight; the App
   Store submission asks again.
3. **A support page**, if the marketing page is judged insufficient — see §2.
4. **Sign-in with Apple**, if Google sign-in stays. Apple requires it alongside any third-party
   sign-in that collects profile data. ⚠️ **CAPS offers Google and does not offer Apple.** This is a
   likely rejection and it is a code change, not a metadata one.
5. **The in-app account-deletion control actually working.** Apple requires an in-app deletion path
   for apps supporting account creation. Ours is present but **guaranteed to fail** — the RPC is
   revoked. The button honestly says so and points at email, which may pass, but it is the second
   most likely rejection after §4.
6. **A decision about the empty lobby.** The listing does not promise waiting opponents, but a
   reviewer opening the multiplayer lobby will find no tables. That is survivable; it is worth
   knowing before it is a surprise.

**Nothing above is blocked on me.** Items 1 and 2 are Roye in App Store Connect; 3 is a small page I
can build; 4 and 5 are code decisions.
