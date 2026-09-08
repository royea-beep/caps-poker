# App Store Connect — the paste order, and what I could not do

Companion to `docs/listing/LISTING-PACK-2026-09-08.md`, which holds the drafted copy. This file
adds the three things the pack does not: the order App Store Connect presents the fields in, the
exact age-rating question and answer, and the boundary — what I could reach and what I could not.

**Live state re-read today** (workflow run `34270807514`, `store-listing`, GET only, success).
Nothing has changed since 2026-09-08: every one of the five blocking fields is still `null`, there
are zero screenshots, and the age-rating questionnaire is still entirely unanswered.

---

## ⚠️ THE BOUNDARY — READ THIS FIRST

**I could not fill the fields, and I did not try.** The reason is specific, not a shrug:

1. **There is no App Store Connect credential in this container.** The key exists only as GitHub
   Actions secrets (`APPLE_API_KEY_ID`, `APPLE_API_ISSUER_ID`, `APPLE_API_KEY_BASE64`). Every ASC
   action has to go through a workflow dispatch.
2. **The key demonstrably WRITES — but to TestFlight, which is a different permission area.** Run
   `34135814835` on 2026-09-07 PATCHed a beta group's public link and confirmed it by reading the
   group back from Apple. That proves write access to `betaGroups`. It does **not** prove write
   access to `appStoreVersionLocalizations` or `appInfos`: an ASC key with the **Developer** role
   can do the first and not the second, while **App Manager** can do both. The evidence is
   consistent with either role, so writability for the listing is **unproven**.
3. **There is no dry run.** Apple offers no way to test a metadata PATCH without performing it, so
   "find out whether I can write" and "write to Roye's live listing" are the same act.
4. **Doing it needs a new workflow action, which needs a merge to main.** `testflight-manage.yml`
   validates its `action` input against a fixed `choice` list. A new `store-listing-write` option
   would have to be on the default branch to be dispatchable, and merging is outside every VAMOS
   sprint's scope.

A half-filled live listing is worse than an empty one plus a good document. So: the document.

**What a future sprint needs to do it by API in one step** — the record IDs, read today:

| record | id |
|---|---|
| app | `6760429619` |
| appInfo | `5c17297f-4f19-4a5a-9b6c-fe8bb0f0654d` |
| appStoreVersion (1.0, `PREPARE_FOR_SUBMISSION`) | `32f6e99e-a82d-47da-96be-7412610a68b1` |
| appStoreVersionLocalization (en-US) | `6beab340-07c8-43ed-90ca-30c8d9065092` |

`tools/asc/lib.rb` already supports PATCH; `tools/asc/store_listing.rb` already resolves every one
of those IDs. The writer is a small extension of files that exist — it is the merge, not the code,
that is missing.

---

## THE PASTE ORDER — App Store Connect, top to bottom

Open **App Store Connect → Apps → CAPS → the 1.0 iOS version** in the left sidebar.

### 1. App Information (left sidebar, above the version)

| field | paste | note |
|---|---|---|
| **Name** | `CAPS Poker` | currently `CAPS - Card game`, which matches nothing else in the product |
| **Subtitle** | `Multi-board poker, free` | 23 characters, limit 30 |
| **Privacy Policy URL** | `https://caps.ftable.co.il/privacy.html` | live, HTTP 200, 10,776 bytes, verified today |
| **Primary Category** | `Games` → `Card` | |
| **Secondary Category** | `Games` → `Strategy` | |

⚠️ **Not Casino.** It invites the gambling review lens, region restrictions and real-money
questions the product does not need to answer. The age rating declares simulated gambling honestly
on its own.

### 2. Age Rating (App Information → Age Rating → Edit)

⚠️ **The task is to ANSWER the questionnaire, not to raise a number.** It has never been answered:
every field reads `null` and the override is `NONE`, so the app is currently **unrated**, which is
its own submission blocker.

**The one question that matters, named exactly:**

> **"Contests" → "Simulated Gambling"** — *Simulated gambling, such as casino games, betting or
> wagering, where no real currency or prizes are involved.*
>
> **Answer: `Frequent/Intense`.**

Every other question is `None`. CAPS has no violence, no sexual content, no profanity, no horror,
no drugs, no unrestricted web access and no user-generated content.

Answer honestly and Apple will compute the rating itself. **Do not use the age-rating override.**

### 3. The 1.0 version page

| field | paste |
|---|---|
| **Promotional Text** | see `LISTING-PACK-2026-09-08.md` §1 |
| **Description** | see `LISTING-PACK-2026-09-08.md` §1 — the full block |
| **Keywords** | see `LISTING-PACK-2026-09-08.md` §1 |
| **Support URL** | see `LISTING-PACK-2026-09-08.md` §2 |
| **Marketing URL** | `https://caps.ftable.co.il/landing.html` *(optional)* |
| **What's New** | leave blank — this is the first version, the field is for updates |

### 4. Screenshots

Upload from `docs/product-map/store-515/` — nine screens at 1320×2868 (6.9″, Apple's current
primary). Seven are named in the pack, in order. Apple requires at least one.

---

## ⚠️ STILL BLOCKING A REAL SUBMISSION — beyond metadata

Each of these is measured, not assumed:

1. **Export compliance has never been answered.** `GET /v1/apps/{id}/appEncryptionDeclarations`
   returns **HTTP 404** — no declaration exists at all. Every build needs one before it can be
   submitted. `testflight-manage.yml` has an `answer-export-compliance` action for this.
2. **Zero screenshots are uploaded.** `screenshots: []`. Apple requires at least one.
3. **The version record still reads 1.0, created 2026-03-11**, while the app is 2.7.0. Roye should
   decide whether to submit as 1.0 or create a new version record.
4. **A build must be selected on the version.** My read did not include the version's build
   relationship, so confirm this one in the dashboard rather than taking it from me.
5. **Two likely rejections that are CODE, not metadata**, already named in the pack and unchanged:
   Google sign-in shipping without Sign in with Apple, and the in-app delete-account control that
   cannot work because `delete_user_account` is revoked for both `anon` and `authenticated`.

Items 1–4 are Roye's to do in the dashboard or by one workflow dispatch. Item 5 needs code.
