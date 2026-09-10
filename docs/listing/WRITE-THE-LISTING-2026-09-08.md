# WRITE-THE-LISTING — 2026-09-08

**Roye chose the write.** He was told there is no dry run and that a failure lands on the live
listing. Seven fields are now filled on App Store Connect and the age-rating questionnaire is
answered. **Nothing was submitted for review.**

Branch `claude/vamos-caps-align-celebration-flppo0`. App `6760429619`, team `3K9KJNGL9U`.

---

## ⚠️ FIRST, A CORRECTION TO MY OWN BOUNDARY

`docs/listing/ASC-PASTE-ORDER-2026-09-08.md` said a write was impossible without a merge:

> "A new `store-listing-write` option would have to be on the default branch to be dispatchable,
> and merging is outside every VAMOS sprint's scope."

**That is false, and the repo's own run history disproved it in one query.** Commit `09114f86`
ADDED the `store-listing` option on this same branch, and run `34163935410` dispatched it
successfully with `ref` = the branch, days before the merge. `set-public-link` and its
`link_enabled` input went the same way (run `34135814835`).

GitHub resolves a dispatch's trigger AND its inputs from the file **on the target ref**. That is
the very mechanism that makes `asc-details.yml` and `asc-list.yml` UNdispatchable — no ref carries
their file. I had the rule right last sprint and applied it backwards this one. There was never a
merge in the way.

---

## THE ONE FIELD, FIRST

Per the brief: the smallest, least visible field, then a separate read-back, then a decision.

| | |
|---|---|
| **Field** | `promotionalText` — the least visible of the two candidates, and it lives on the record that carries most of the rest |
| **Preview run** (`34278259777`, apply=false) | resolved every record id, printed BEFORE `nil`, wrote nothing |
| **Write run** | `34278446382` |
| **PATCH** | HTTP 200 |
| **Read-back** (a SEPARATE GET) | `"Four cards on every board. Every board plays at once. Win the most boards, win the hand. Free play with virtual chips — no real money, ever."` |
| **Verdict** | ✅ **LANDED.** The credential writes App Store listing metadata. |

⚠️ The verdict is the read-back, never the 200. An anon PATCH on `leaderboard` returned HTTP 204
this week and changed nothing; the script's exit code depends only on what Apple serves back.

---

## EVERY FIELD, READ BACK FROM APPLE

Independent verification: run `34282378266`, action `store-listing`, GET only, after all writes.

| field | record | before | after | run |
|---|---|---|---|---|
| **Promotional text** | versionLocalization | `null` | the 140-char line | `34278446382` |
| **Description** | versionLocalization | `null` | 1,253 chars, unwrapped | `34278742972` |
| **Subtitle** | appInfoLocalization | `null` | `Multi-board poker, free` | `34278988106` |
| **Keywords** | versionLocalization | `null` | `multiboard,omaha,…,casual` (88) | `34279223477` |
| **Privacy policy URL** | appInfoLocalization | `null` | `https://caps.ftable.co.il/privacy.html` | `34279476099` |
| **Support URL** | versionLocalization | `null` | `https://caps.ftable.co.il/landing.html` | `34279694347` |
| **Category** | appInfo | `nil/nil/nil` | `GAMES` / `GAMES_CARD` / `GAMES_STRATEGY` | `34280822473` |
| **Age rating** | ageRatingDeclaration | every question `null` | answered; **`SEVENTEEN_PLUS`** | `34282117761` |

**Deliberately NOT written**, and each is a finding rather than an omission:

- **`name`** is still `CAPS - Card game` while everything else says CAPS POKER. Changing the store
  name is an identity decision and the brief did not list it. One dispatch away: `field: name`.
- **`marketingUrl`** is `null`. Optional; not asked for.
- **`whatsNew`** is `null`. Correct — the field is for updates and this is version 1.0.

---

## THE AGE RATING — ANSWERED, NOT SET

⚠️ **The task was to answer the questionnaire, never to raise a number, and that is what happened.**
`ageRatingOverride` reads `NONE` and was never written; it is on a hard never-send list beside
`koreaAgeRatingOverride` and `kidsAgeBand`. **17+ is Apple's own computation from the answers.**

**Simulated Gambling → `FREQUENT_OR_INTENSE`.** Every other question `NONE` or `false`.

⚠️ **APPLE'S QUESTIONNAIRE IS ALL-OR-NOTHING, AND APPLE SAID SO ITSELF.** The first attempt sent
only `gamblingSimulated`, because that is the one question that decides the rating. Apple refused
with HTTP 409 carrying **21 separate `ENTITY_ERROR.ATTRIBUTE.REQUIRED` errors** — "You must provide
a value for the attribute 'gambling' with this request", and twenty more. Nothing was written. That
is the same rule a human meets in the dashboard: answer the whole form, save once.

**The field list is Apple's, not mine.** The required attributes are parsed out of Apple's own
`source.pointer` values rather than typed from a remembered schema. The same trick settles which
questions are scales and which are yes/no: send `"NONE"` everywhere and Apple names the booleans
back. Nine of them: `advertising`, `ageAssurance`, `gambling`, `healthOrWellnessTopics`, `lootBox`,
`messagingAndChat`, `parentalControls`, `unrestrictedWebAccess`, `userGeneratedContent`.

Iterating was free precisely because the form is atomic — every refusal wrote nothing, which the
failed single-answer attempt had already demonstrated.

---

## ⚠️ THREE INSTRUMENT FAILURES, ALL MINE, ALL CAUGHT BY LOOKING AT THE OUTPUT

**1. The category id existed; its ROLE did not.** I listed `appCategories` with
`include=subcategories`, merged `data` and `included` into one pool, found `GAMES_CARD` and printed
`resolved primary GAMES_CARD`. The id was real. `GAMES_CARD` is a **subcategory** of `GAMES` and can
never be a top-level category. Apple refused with `ENTITY_ERROR.RELATIONSHIP.INVALID` on **both**
`primaryCategory` and `secondaryCategory`. Existence is not fitness — the same class as a filename
that matches while the bytes do not. Apple's real model is one category plus up to two
subcategories; the pack's "secondary: Games › Strategy" was my mis-description of a subcategory, and
`secondaryCategory` is now never sent.

**2. `patch!` threw away Apple's reason.** The first 409 printed a status code and nothing else. I
was one step from filing "the credential cannot set a category" — a permission finding with the
actual cause sitting unread in a response body. Every non-2xx now prints Apple's status, code,
title, detail and `source` pointer.

**3. Ten was a page, not a catalogue.** The corrected guard read the subcategories through an
`include` and got exactly ten ids with no `GAMES_CARD` — so it refused, correctly on its own terms,
and would have had me report "Apple does not offer a Card subcategory." A relationship array inside
an `include` is **paged**; my `limit=50` applied to the top-level query. Read from
`/v1/appCategories/GAMES/subcategories` with an explicit limit, `GAMES_CARD` is there. The guard now
prints the count and aborts outright if a `next` link appears.

And a fourth, in the handler rather than the read: Apple reports a wrong type under
`ENTITY_ERROR.ATTRIBUTE.TYPE`, not `.INVALID`. My code watched only `.INVALID`, ignored nine errors
that named the booleans explicitly, and printed "errors this script cannot act on". The oracle had
answered; I was reading the wrong line.

⚠️ **In this session I also told Roye that a runner had sat on `gem install fastlane` for twenty
minutes and that GitHub's jobs API was serving a stale state. Both were wrong.** My background
`sleep` calls did not consume wall-clock time, so I read about sixty seconds of real elapsed time as
twenty minutes. The job was simply still installing. No workflow was changed on that false basis.

---

## STILL BLOCKING A REAL SUBMISSION

Metadata is no longer the blocker. What remains, each measured today:

1. **Zero screenshots.** `"screenshots": []`. Apple requires at least one. Eighteen are ready in
   `docs/product-map/store-515/`. Not uploaded — the brief said not to unless it was trivially part
   of a field write, and it is a different API (reservation, chunked upload, commit).
2. **Export compliance has never been answered.** `GET /v1/apps/{id}/appEncryptionDeclarations`
   still returns **HTTP 404** — no declaration exists.
3. **The version record still reads 1.0, created 2026-03-11**, while the product is 2.7.0 build 515.
   Roye decides whether to submit as 1.0 or create a new version record.
4. **A build must be selected on the version.** Not read here; confirm in the dashboard.
5. **The store name is `CAPS - Card game`.** Cosmetic, but it matches nothing else in the product.
6. **Two likely rejections that are CODE, not metadata**, unchanged: Google sign-in shipping without
   Sign in with Apple, and the in-app delete-account control that cannot work because
   `delete_user_account` is revoked for both `anon` and `authenticated`.

⚠️ **And one compromise, reported not hidden: the support URL is the landing page.** The pack
recommends a dedicated `/support.html`; measured today it returns **HTTP 404** — the page does not
exist. `landing.html` returns 200 and does carry `caps@ftable.co.il`, so it is honest and reachable.
It is also marketing, and Apple has rejected support URLs that only sell. Changing it later is one
dispatch.

---

## HOW TO CHANGE ANY OF IT

Actions → Manage TestFlight → `store-listing-write`, pick one `field`, leave `apply` **false** to
preview the before/after, set it **true** to write. One field per run, on purpose: a run that wrote
five and hit a wall on the third would leave a half-filled live listing.

To revert a text field, the run that wrote it prints its own undo line naming the previous value and
the endpoint.

The copy is **parsed at runtime** from `docs/listing/LISTING-PACK-2026-09-08.md`, so editing the
pack changes what gets written and there is no second copy to drift.
`tests/listing-copy.test.ts` pins the parse (5/5 green).

**Production unchanged:** no economy value, flag, cue, layout, card size or 83px arc. No Edge
Function deployed. No migration. No `game_rooms` or `room_players` row touched. The entire code diff
is `.github/`, `tools/asc/`, `tests/` and `docs/`.
