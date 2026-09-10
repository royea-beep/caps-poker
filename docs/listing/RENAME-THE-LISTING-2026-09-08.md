# RENAME-THE-LISTING — 2026-09-08

**One field. `CAPS - Card game` → `CAPS Poker`.** Roye approved it on consistency grounds, with the
honest caveat that there is no search data behind it — the icon, the home masthead and the landing
page all say CAPS POKER while the store said "Card game".

Branch `claude/vamos-caps-align-celebration-flppo0`. App `6760429619`.

---

## THE WRITE

| | |
|---|---|
| **Preview** (`34284889330`, apply=false) | `BEFORE name = "CAPS - Card game"` · `INTEND name = "CAPS Poker"` (10 chars) · wrote nothing |
| **Write** (`34285144841`) | PATCH `/v1/appInfoLocalizations/7d60730c-a3f3-4e30-8d4c-dfafe5416b52` |
| **Read-back** (a SEPARATE GET) | `AFTER name = "CAPS Poker"` |
| **Verdict** | ✅ **LANDED** |

**No uniqueness objection.** App Store names are unique across the store and Apple checks on write;
it accepted this one without comment. Had it refused, the run would have printed Apple's status,
code, title, detail and `source` pointer — the `patch!` fix from the previous sprint exists for
exactly that moment — and the rule was to stop and let Roye pick, never to invent a variant.

**To revert:** set it back to `CAPS - Card game` on that same endpoint. The run prints that line
itself.

---

## ⚠️ WHAT ELSE CARRIES A NAME — AND THERE ARE THREE CASINGS, NOT ONE

Measured, not assumed. Every row below was read from the file or the generated artefact.

| where | what it says now | source |
|---|---|---|
| **App Store listing name** | **`CAPS Poker`** ✅ | just written |
| **iOS home-screen label** | **`Caps Poker`** | `ios/CapsPoker/Info.plist` → `CFBundleDisplayName` |
| `app.json` `expo.name` | **`Caps Poker`** | the source the label is generated from |
| **Web tab title** | **`Caps Poker`** | `dist/index.html` `<title>`, from `expo.name` |
| **Landing page title** | **`CAPS POKER`** | `public/landing.html` `<title>` |
| Privacy page title | `CAPS Poker` | root `privacy.html` |
| Terms page title | `CAPS Poker` | root `terms.html` |
| In-app onboarding card | `CAPS Poker` | `app/(tabs)/index.tsx:514,519` |
| Share cards | `♠ CAPS POKER ♦` | `components/ShareCard.tsx` ×4 |
| Orientation / theme pickers | `CAPS POKER` | `app/orientation-pick.tsx:36`, `app/theme-pick.tsx:26` |
| Legal block, both languages | `CAPS Poker` | `utils/i18n.ts:949,1370` |
| Bundle id | `com.capspoker.app` | unchanged, and correctly not a display name |
| `package.json` name | `caps-poker` | a package id, not a display name — correct as is |

**WHICH DISAGREE — reported, NOT changed:**

1. **The device home-screen label reads `Caps Poker`, sentence case.** It comes from
   `app.json` `expo.name`, and `ios/` is prebuild output that is not tracked, so the label is
   regenerated from that one line. The store now says `CAPS Poker`. A player installing from the
   store sees one name on the listing and a differently-cased one under the icon.
2. **The landing page title says `CAPS POKER`, all caps** — a third form.
3. The in-app surfaces are themselves split: onboarding and the legal block say `CAPS Poker`, while
   share cards and the two picker screens say `CAPS POKER`.

⚠️ **This is a real inconsistency and it is small, but it is the same class as a filename that does
not match its bytes — and this project has paid for that shape eight times.** None of it was
changed: the brief said report first, and `expo.name` is an app-level change that would need a
rebuild, which is outside this sprint.

**The cheapest fix, if Roye wants it:** one line — `app.json` `expo.name` → `CAPS Poker`. That
moves the device label and the web tab title together, because both derive from it. The landing
page title is a second one-line edit. Neither is done here.

**WHICH ARE ROYE'S TO CHANGE:** the **social account bios**. ⚠️ And I could not read them — no
handle, URL or bio text for any social account exists anywhere in this repository. What exists is
image assets sized per platform (`docs/social/caps-profile-instagram-320.png`,
`caps-profile-tiktok-200.png`, `caps-profile-facebook-360.png`,
`caps-cover-facebook-1640x664.png`). Whether the accounts exist at all, and what their bios say, is
unknown from here — a thing to check, never a thing to assert.

---

## LISTING STATE AFTERWARDS — READ FROM APPLE

Run `34285359921`, `store-listing`, GET only, after the write.

| field | value |
|---|---|
| **name** | **`CAPS Poker`** ✅ *(changed this sprint)* |
| subtitle | `Multi-board poker, free` |
| privacyPolicyUrl | `https://caps.ftable.co.il/privacy.html` |
| description | 1,253 chars |
| keywords | 88 chars |
| promotionalText | 140 chars |
| supportUrl | `https://caps.ftable.co.il/landing.html` |
| marketingUrl | `null` *(optional, not asked for)* |
| whatsNew | `null` *(correct — the field is for updates and this is 1.0)* |
| category | `GAMES` / `GAMES_CARD` / `GAMES_STRATEGY` |
| appStoreAgeRating | `SEVENTEEN_PLUS` *(Apple's computation; override never written)* |
| screenshots | `[]` — still zero |
| version | `1.0`, `PREPARE_FOR_SUBMISSION`, created 2026-03-11 |
| appEncryptionDeclarations | **HTTP 404** — none exists |

**NOT SUBMITTED FOR REVIEW.** No build selected. Version state unchanged. Pricing, availability and
territories untouched.

---

## STILL BLOCKING A REAL SUBMISSION

Unchanged from yesterday, and none of it is metadata:

1. **Zero screenshots uploaded.** Apple requires one. 18 ready in `docs/product-map/store-515/`;
   uploading is a separate API (reserve, chunked upload, commit).
2. **Export compliance never answered** — `appEncryptionDeclarations` still 404.
3. **The version record still reads 1.0 from 2026-03-11** while the product is 2.7.0 build 515.
4. **A build must be selected on the version.** Confirm in the dashboard.
5. **Two code rejections:** Google sign-in without Sign in with Apple, and the in-app
   delete-account control that cannot work because `delete_user_account` is revoked.

And now a sixth, new and small: **the device label and the store name disagree in casing.**

**Production unchanged:** no economy value, flag, cue, layout, card size or 83px arc. No Edge
Function. No migration. No `game_rooms` row. The diff is `docs/`, `tools/asc/` and `tests/`.
