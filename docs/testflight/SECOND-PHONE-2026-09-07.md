# TESTFLIGHT — THE SECOND PHONE, 2026-09-07

## The answer

**`royearguan@gmail.com` is already a TestFlight tester, and an INTERNAL one.** Nothing was added,
because adding would have created the duplicate the brief warned against.

He is in **both** groups — "Internal Testers" and "Friends" — with invite type `EMAIL`. The
"Internal Testers" group carries `has_access_to_all_builds = true`, so it receives every build
automatically with no Beta App Review wait. Build **514** is `VALID` and not expired.

**So if the second phone is signed into `royearguan@gmail.com`, CAPS is already installable on it
right now.** Open TestFlight on that phone; it should be listed.

⚠️ **The one thing I cannot check, and only Roye can.** Whether that second phone is on that Apple
ID at all. On the phone: Settings → tap the name at the top → the email underneath is its Apple ID.

* **Reads `royearguan@gmail.com`** → open TestFlight. Done. Two devices, and multiplayer becomes
  testable.
* **Reads something else** → that other address needs adding, and it is an address nobody has
  written down. The workflow can now do it: dispatch `testflight-manage.yml` with
  `action: add-tester` and that email. It checks for a duplicate first and prefers the internal
  group.
* **Third route, works on any Apple ID:** the "Friends" group has a public link enabled —
  `https://testflight.apple.com/join/hD3KvZeC`. Opening that on the second phone joins it without
  any tester management. ⚠️ Friends is an **external** group, so it only serves builds approved for
  external testing, and I could not read which build that is (see the limitation below). Treat it
  as a fallback, not the first thing to try.

---

## §1 · The current testers — five

Read from App Store Connect on 2026-09-07, run
[34105291751](https://github.com/royea-beep/caps-poker/actions/runs/34105291751), conclusion
**success**.

App: **CAPS - Card game** (`6760429619`, `com.capspoker.app`)

### Beta groups

| group | kind | public link |
|---|---|---|
| Internal Testers | **INTERNAL** | off |
| Friends | EXTERNAL | `https://testflight.apple.com/join/hD3KvZeC` |

### Testers

| email | name | invite | internal? | groups |
|---|---|---|---|---|
| `aviavitan2211@gmail.com` | אבי אביטן | EMAIL | **INTERNAL** | Internal Testers, Friends |
| **`royearguan@gmail.com`** | **Roye Arguan** | EMAIL | **INTERNAL** | Internal Testers, Friends |
| `ftable.aa@gmail.com` | Feature Table | EMAIL | **INTERNAL** | Internal Testers, Friends |
| *(no email)* | Anonymous | PUBLIC_LINK | external | Friends |
| `amitayar@gmail.com` | Ami Tayar | EMAIL | **INTERNAL** | Internal Testers, Friends |

**Total: 5.** Four real people plus one anonymous public-link join. Roye had not seen this list
before; it is worth having ahead of the tester round, and it says the round starts from four
known devices, not zero.

## The workflow had to be fixed before any of this could be read

`testflight-manage.yml` was the **last** App Store Connect workflow still logging in as
`royearguan@gmail.com` with an app-specific password plus a cached `FASTLANE_SESSION`. That path
is dead and **had never once succeeded** — all four dispatches before today failed, most recently
with:

```
The login credentials for 'royearguan@gmail.com' seem to be wrong
```

That is the expected end state for the mechanism: an app-specific password dies when the Apple ID
password changes, and a session cookie expires in about a month regardless.

Meanwhile **every other** ASC workflow here — `ios-testflight`, `ios-testflight-free`,
`asc-submit`, `asc-cert-audit`, `asc-fetch-profile`, `delete-asc-version` — has been using an
**App Store Connect API key** all along, and it works: it uploaded build 514 on 2026-09-02. So the
premise that I have Apple access was half right. I had a working credential; the tester workflow
was pointed at a dead one.

The fix, approved before it was made: the same key setup step copied from `ios-testflight.yml`,
and `Spaceship::ConnectAPI.login(user)` → `.auth(key_id:, issuer_id:, filepath:)`. **No new secret
was needed.** Three behaviour changes came with it — `list-testers` now also prints the groups and
the builds, `add-tester` checks for a duplicate first and prefers the internal group, and every
attribute is read through a `safe()` helper.

### ⚠️ Two things I got wrong and corrected, rather than leaving in place

1. **I warned that API-key auth might not see internal testers.** It does. The run above lists four
   of them. The caveat was wrong and the file now says so.
2. **My first fixed run still failed** — on `undefined method 'state'`, a field that does not exist
   on this Spaceship version. It had already authenticated, found the app and printed both groups,
   then threw the whole listing away on one bad attribute name. That is why every read now goes
   through `safe()`: a reporting job must not be able to lose a report it already has.

### A limitation that is stated, not hidden

`build.get_beta_groups` raises `NoMethodError` on this Spaceship version, so **I could not read
directly which groups each build is shared with.** Every build row says
`groups: (could not read: NoMethodError)` and that is honest rather than blank.

The internal half is still settled, by a different fact: "Internal Testers" carries
`has_access_to_all_builds = true`, so its members get every build with nothing to configure.
**What is not settled is which build the external "Friends" group and its public link serve** —
that needs a look at App Store Connect in a browser.

## §2 · Nothing added

`royearguan@gmail.com` was already present, so per the brief the correct action was none. No
tester was added, removed or modified.

## §3 · Which build the second phone gets — 514, and it is five days behind

**Build 514**, version 2.7.0, uploaded **2026-09-02**, `VALID`, not expired. It is the newest;
nothing has been dispatched since.

### What 514 contains

Everything on `main` up to 2026-09-02: the six security closes, the three-tab navigation, the D1
home screen, the working shop, the two-currency reset, the splash rebrand, the bilingual landing
page, and the **Hebrew UI going live** — 514 was built specifically to ship that.

### ⚠️ What it does NOT contain — 29 commits, all of this week

Everything from 2026-09-03 onward is on `claude/vamos-caps-align-celebration-flppo0`, unmerged and
unbuilt:

* **The F icon** and its config plugin. 514 still shows the **C1 playing-card icon**.
* **The Show tips toggle**, and the fix that makes a dismissed tip stay dismissed.
* **The splash edge fix** — 514 still shows faint side bars on short devices.
* **The i18n completion** — Settings, shared chrome, the Back control, and the English leaks.
* The referral truncation fix, the app-open auth gate, the client-side S1 economy work, the
  bug-report timeout, the multiplayer tie `outcome` field, the catch-all 404 fix, the FIVE-O copy
  correction, and the leaked-token rotation.

**So the second phone would show an app that predates every visible change of the last five days.**
Two further commits sit on `main` but not in 514 (the landing screenshot fixes); those are web-only.

### A fresh build would carry all 29 — and needs a bump and a merge

`app.json` says `ios.buildNumber` **514** on both `main` and the branch. 514 is already on
TestFlight and Apple rejects a re-upload of the same `CFBundleVersion`, so a fresh build needs
**515**, plus a merge to `main` because `ios-testflight.yml` builds from `main`.

**Not triggered. No merge, no bump, no build dispatched.** Roye's call.

## Also found — a stale record, not touched

`PROJECT-INFO.json` disagrees with reality on three values: `bundle_id` `com.royea.capspoker` (real:
`com.capspoker.app`), `current_version` 2.6.0 (real: 2.7.0), `current_build` 457 (real: 514). The
brief's bundle ID matches the real one, so nothing was acted on wrongly. Left as found.

## Nothing changed in the product

* **No tester added, removed or modified.**
* Nothing submitted for App Review. No metadata, pricing or availability touched.
* No merge, no version bump, no build dispatched.
* No economy, flag, cue, layout or security change. No Edge Function deployed — `verify_jwt`
  unchanged everywhere.
* The only write was to `.github/workflows/testflight-manage.yml`, plus this document.
