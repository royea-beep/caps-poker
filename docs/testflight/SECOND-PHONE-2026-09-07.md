# TESTFLIGHT — THE SECOND PHONE, 2026-09-07

**I could not list or add TestFlight testers, and the reason is specific and fixable.** The
premise that I have Apple access is half right: I have a *working* App Store Connect **API key**,
which is what uploads builds. The workflow that manages testers uses a *different* and **dead**
credential — an Apple ID password — and it fails at login before it reaches App Store Connect.

No tester list is reported below, because I do not have one. Reporting a guessed list would be
worse than reporting none.

---

## §1 · What I tried, and exactly how it failed

`.github/workflows/testflight-manage.yml` has a `list-testers` action. I dispatched it:

* Run [34104012841](https://github.com/royea-beep/caps-poker/actions/runs/34104012841), 2026-09-07,
  `macos-latest`, conclusion **failure** after 54 seconds.
* The failing step is "Run TestFlight management". The error, verbatim:

```
The login credentials for 'royearguan@gmail.com' seem to be wrong
The password was taken from the environment variable
```

This is not new. The same workflow has been dispatched **four** times before and the last two both
failed the same way — 2026-08-08 returned `Invalid username and password combination. Used
'royearguan@gmail.com' as the username.` **It has never once succeeded.** So there is no historical
run whose log I could read a tester list out of either; I checked.

### The diagnosis, and why the build pipeline is unaffected

Two different Apple credentials exist in this repo, and only one of them works.

| | credential | used by | state |
|---|---|---|---|
| **API key** | `APPLE_API_KEY_ID`, `APPLE_API_ISSUER_ID`, `APPLE_API_KEY_BASE64` | `ios-testflight.yml`, `ios-testflight-free.yml`, `asc-submit.yml`, `asc-cert-audit.yml`, `asc-fetch-profile.yml`, `delete-asc-version.yml` | **WORKS** — it uploaded build 514 on 2026-09-02 |
| Apple ID password | `APPLE_APP_SPECIFIC_PASSWORD`, `FASTLANE_SESSION` | `testflight-manage.yml` only | **DEAD** — rejected at login |

`testflight-manage.yml` is the only workflow still on the old path. App-specific passwords get
revoked when an Apple ID password changes, and a `FASTLANE_SESSION` cookie expires in about a month
regardless — so a dead value here is the expected end state, not a mystery.

**None of the six API-key workflows lists or adds testers.** I read all of them. So there is no
existing route I can dispatch that answers the question.

### The fix, which is small

`testflight-manage.yml` should authenticate the way every other ASC workflow already does. In
Spaceship that is `Spaceship::ConnectAPI.auth(key_id:, issuer_id:, filepath:)` instead of
`Spaceship::ConnectAPI.login(user)`, plus the three-line step that decodes `APPLE_API_KEY_BASE64`
into a `.p8` — copied from `ios-testflight.yml` lines 83–92, which is proven working. No new secret
is needed; all three already exist and are valid.

**I have not made that change.** This sprint's edit scope is `docs/` and a workflow is code. It is
one file and the credentials to make it work are already in the repo.

## §2 · Not added — and I could not have known whether it would be a duplicate

`royearguan@gmail.com` **not confirmed present or absent.** The check the brief rightly asked for
first is the check I could not run, and adding blind risks exactly the duplicate it warned against.

### But the answer may not need App Store Connect at all

`royearguan@gmail.com` is the Apple ID this project's tooling logs in as — it is the App Store
Connect account for CAPS. **An Apple ID that holds an App Store Connect role sees the app in
TestFlight without being added as a tester at all.** So if the second phone is signed into that
Apple ID, CAPS is very likely already there, and the answer is "open TestFlight on it".

⚠️ **I am flagging that as likely, not proven.** I could not read the account's roles, and I am not
going to present an inference as a verified fact.

**The 20-second check that settles it, and only Roye can do it.** On the second phone:
Settings → tap the name at the top → the email shown underneath is that phone's Apple ID.

* **If it reads `royearguan@gmail.com`** → open TestFlight on that phone. CAPS should be listed.
  If it is not, that is a real finding and the workflow fix above becomes necessary.
* **If it reads something else** → that other address is what needs adding as a tester, not
  `royearguan@gmail.com`. Which makes the workflow fix necessary either way, and means the email to
  add is one nobody has written down yet.

## §3 · Which build the second phone would get, and what is in it

**Build 514.** Uploaded 2026-09-02 from `8da8cbb` on `main`. It is the newest build on TestFlight —
no build has been dispatched since, and `ios-testflight.yml`'s last successful run is that one.

### What 514 contains

Everything on `main` up to 2026-09-02, which is a lot: the six security closes, the three-tab
navigation, the D1 home screen, the working shop, the two-currency reset, the splash rebrand, the
bilingual landing page, and the **Hebrew UI going live** — 514 was built specifically to ship
FINISH-HEBREW.

### ⚠️ What it does NOT contain — 29 commits, all of this week

Everything from 2026-09-03 onward is on `claude/vamos-caps-align-celebration-flppo0`, unmerged and
unbuilt:

* **The F icon** — the whole responsive lockup and the config plugin. 514 still shows the **C1
  playing-card icon** on the home screen.
* **The Show tips toggle**, and the fix that makes a dismissed tip stay dismissed.
* **The splash edge fix** — 514 still shows faint side bars on short devices.
* **The i18n completion** — Settings, shared chrome, the Back control, and the English leaks.
* The referral truncation fix, the app-open auth gate, the S1 economy close on the client side,
  the bug-report timeout, the multiplayer tie `outcome` field, the catch-all 404 fix, the FIVE-O
  copy correction, and the leaked-token rotation.

**So the second phone would receive an app that predates every visible change of the last five
days.** Two commits also sit on `main` but not in 514 (the landing screenshot fixes), and those are
web-only.

### A fresh build would contain all 29 of those, and would need a bump

`app.json` says `ios.buildNumber` **514** on both `main` and the branch. 514 is already on
TestFlight and Apple rejects a re-upload of the same `CFBundleVersion`, so a fresh build needs
**515** — plus a merge to `main`, since `ios-testflight.yml` builds from `main`.

**Not triggered.** No merge, no bump, no build dispatched. That is Roye's call.

## Also found — a stale record, not touched

`PROJECT-INFO.json` at the repo root disagrees with reality on three values:

| field | PROJECT-INFO.json | actually |
|---|---|---|
| `bundle_id` | `com.royea.capspoker` | `com.capspoker.app` |
| `current_version` | 2.6.0 | 2.7.0 |
| `current_build` | 457 | 514 |

The brief's bundle ID (`com.capspoker.app`) matches the real one, so nothing was acted on wrongly.
Left as found — it is outside this sprint's scope and correcting a record is its own small job.

## Nothing was changed

* **No tester added, none removed, none modified.**
* Nothing submitted for App Review. No metadata, pricing or availability touched.
* No merge, no version bump, no build dispatched.
* No economy, flag, cue, layout or security change. No Edge Function deployed — `verify_jwt`
  unchanged everywhere.
* The only thing this sprint did to the outside world was dispatch one read-only `list-testers`
  workflow run, which failed at login and changed nothing.
