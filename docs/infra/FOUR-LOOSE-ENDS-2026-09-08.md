# FOUR-LOOSE-ENDS — 2026-09-08

Items 8, 5, 4 and 7. Two were mine to finish, two were not, and the boundary is stated before the
findings rather than after them.

Nothing in the app changed: no economy value, no flag, no cue, no layout, no card size, no 83px
arc. No Edge Function deployed. **Nothing submitted to Apple.** No workflow deleted. No billing or
subscription status asserted.

| item | reach | outcome |
|---|---|---|
| **#8** phantom workflows | fully reachable | ⚠️ my earlier finding was wrong — corrected below. Reported, not deleted. |
| **#5** splash | fully reachable | verified still current, by measurement |
| **#4** store listing | **read only** | five fields still null; paste document written |
| **#7** backups | **partly** | WAL state read; the add-on is not readable and is not asserted |

---

## §1 — THE PHANTOM WORKFLOWS (#8)

### ⚠️ I WAS WRONG ABOUT THESE, AND THE CORRECTION IS THE FINDING

In FINAL-QA I called them *"two workflows GitHub lists as active with NO FILE anywhere in this
clone's history — two dispatchable workflows backed by nothing."* Two of those three claims are
false.

**They are not backed by nothing. They ran, and they hold the Apple signing key.**

| | `asc-details.yml` | `asc-list.yml` |
|---|---|---|
| workflow id | 276765913 | 276759157 |
| runs, ever | **1** | **1** |
| when | 2026-05-14 14:25:18Z | 2026-05-14 14:14:03Z |
| event / branch | `push` on `recovery/may4-clean` | `push` on `recovery/may4-clean` |
| conclusion | **success** | **success** |
| commit | `8e77cfe` "add ASC details workflow" | `2e25b87` "add ASC list-builds workflow" |

Both files were read back from their own run commits — GitHub still serves the blobs even though
the branch is gone. Both:

- read `secrets.APPLE_API_KEY_ID`, `APPLE_API_ISSUER_ID` and `APPLE_API_KEY_BASE64`, decode the
  `.p8`, and mint an ES256 JWT for App Store Connect;
- then make **read-only** calls — `GET /v1/apps` by bundle id, `GET /v1/builds` — and print build
  version, processing state, uploaded date and expiry. No PATCH, no POST, nothing submitted.

**`recovery/may4-clean` no longer exists.** It is absent from the 65 branches on origin, which is
why the file resolves nowhere.

### And they are NOT dispatchable — proven, not assumed

I attempted a real dispatch of each against `main`. GitHub refused both:

```
failed to run workflow: Workflow does not have 'workflow_dispatch' trigger
```

Both files *do* declare `workflow_dispatch:`. GitHub resolves the trigger from the file **on the
target ref**, and no ref carries the file — so the trigger cannot be found and the dispatch is
rejected. They are inert history records, not live attack surface. The listing shows
`state: "active"` because GitHub never marks a workflow deleted when the branch holding it
disappears; it keeps the record so the run history stays readable.

### Not deleted, and there is no API to delete one anyway

The brief's rule applies twice over — **they have run, and they hold credentials** — so the answer
is report, not delete. It is also moot: the GitHub REST API exposes `/actions/workflows/{id}/enable`
and `/disable` but **no delete**. A workflow record is removed by deleting its file, and the file is
already gone. There is nothing left to remove and nothing live to disable.

Confirmed from GitHub itself, not from a 200: `GET .../contents/.github/workflows/asc-details.yml`
on `main` returns *"the file does not exist in the repository"*, while the same path at commit
`8e77cfe` returns the full text.

---

## §2 — THE SPLASH (#5) — still current, and I did not redo it

`app.json` declares `./assets/splash.png`, `backgroundColor: #071C12`, `resizeMode: contain`.

**The 2026-09-07 edge fix holds.** I decoded the PNG and sampled 240 pixels around all four edges
of the real asset, comparing each against the declared background:

```
assets/splash.png       1284x2778   worst edge deviation from #071C12: 0 channels
assets/splash-icon.png  1284x2778   worst edge deviation from #071C12: 0 channels
```

Zero, not "close". Both files are byte-identical (`md5 3a231e9d139efb81c085c4fc2547543a`), so the
art and the declared background cannot separate into side bars on a short device.

**Native-only, confirmed:** `dist/index.html` contains **0** references to splash. The web export
never paints it — the only hit anywhere in `dist/` is inert `expo-splash-screen` module code inside
the JS bundle. So this belongs on Roye's device list and nowhere else, and it cannot be verified
from a browser.

Nothing was changed.

---

## §3 — THE STORE LISTING (#4) — read only, and here is exactly why

**The deliverable is `docs/listing/ASC-PASTE-ORDER-2026-09-08.md`** — field by field in the order
App Store Connect presents them, with the age-rating question named exactly.

I re-read the live listing today rather than trusting yesterday's report (run `34270807514`,
`store-listing`, GET only, success). Nothing has moved: `description`, `keywords`, `whats_new`,
`promotional_text`, `support_url`, `marketing_url`, `subtitle` and `privacy_policy_url` are all
`null`; `screenshots` is `[]`; every age-rating field is `null` with override `NONE`; the version
still reads 1.0 created 2026-03-11, state `PREPARE_FOR_SUBMISSION`.

### Whether the credential can write — checked, and the answer is "unproven", not "no"

- **It demonstrably writes to TestFlight.** Run `34135814835` on 2026-09-07 PATCHed a beta group's
  public link and confirmed it by reading the group back from Apple.
- **That does not settle the listing.** Beta groups and App Store version metadata are different
  permission areas. An ASC key with the **Developer** role can write the first and not the second;
  **App Manager** can write both. The evidence fits either.
- **Apple offers no dry run**, so "find out" and "write to the live listing" are the same act.
- **And it needs a merge.** There is no ASC credential in this container — the key exists only as
  GitHub Actions secrets, so every ASC call goes through a workflow dispatch, and
  `testflight-manage.yml` validates its `action` against a fixed `choice` list. A new
  `store-listing-write` option has to be on the default branch to be dispatchable, and merging is
  outside every VAMOS sprint's scope.

A half-filled live listing is worse than an empty one plus a good document, so I wrote the document
and left the listing alone. The four record IDs a future write needs are in it; `lib.rb` already
supports PATCH and `store_listing.rb` already resolves those IDs, so it is the merge, not the code,
that is missing.

### Still blocking a real submission, beyond metadata

1. **Export compliance has never been answered** — `GET /v1/apps/{id}/appEncryptionDeclarations`
   returns **404**, no declaration exists at all.
2. **Zero screenshots uploaded**; 18 files are ready in `docs/product-map/store-515/`.
3. **The version record reads 1.0** while the app is 2.7.0.
4. **A build must be selected** — my read did not include the version's build relationship, so
   confirm that one in the dashboard rather than taking it from me.
5. **Two likely rejections that are CODE, not metadata:** Google sign-in without Sign in with
   Apple, and the in-app delete-account control that cannot work.

---

## §4 — THE BACKUPS (#7) — what is readable, and the one thing that is not

### What I CAN verify, read from the database itself

| | |
|---|---|
| `archive_mode` | **on** |
| `wal_level` | `logical` |
| `archive_command` | `/usr/bin/admin-mgr wal-push %p` (Supabase's wal-g archiver) |
| `archive_timeout` | **120 s** — a segment is forced every two minutes even when idle |
| segments archived | **119,797** |
| last archived WAL | `00000001000001D300000072` |
| last archived at | 2026-09-08 22:44:16 — **7.2 seconds before I asked** |
| failures, ever | **2**, the last on **2026-05-05**, four months ago |
| stats since | 2026-02-13 |
| Postgres | 17.6 |

**WAL archiving is healthy and continuous.** 119,797 segments since February with two failures, the
most recent four months old, and a segment landing seconds ago. That is the substrate
point-in-time recovery runs on, and it is working.

### ⚠️ What I will NOT assert

**Whether the PITR add-on is purchased, and what the retention window is.** Neither is exposed to
these tools — `archive_mode = on` is a platform default that also serves Supabase's ordinary daily
backups, so it does **not** prove PITR is enabled or how far back a restore could reach. I also
could not read the plan tier: `get_organization` returned *"You do not have permission to perform
this action"*. I refused this once before and the refusal stands.

### The one thing Roye must check, in a sentence

Open **Supabase → Project Settings → Database → Backups** and look at the **Point-in-Time
Recovery** panel: if it is healthy you will see PITR listed as enabled with a stated recovery
window (7 days on the smallest paid tier) and an "earliest restore point" timestamp roughly that
far in the past — if instead it offers to *upgrade* or shows only a list of daily backups, the
add-on is not active and the recovery window is whatever those daily snapshots give.
