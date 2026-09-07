# ATTACH 515 — what Apple's records actually say

**Date** 2026-09-07 · **App** CAPS Poker `6760429619` / `com.capspoker.app` · **Build** 515
**Method** App Store Connect REST API, self-signed ES256 JWT, read from Apple every time.

---

## The headline: the brief's premise does not survive contact with Apple's records

The brief said the phone was being served build 16 because Roye "joined through the public link,
which belongs to Friends — an EXTERNAL group", and that 515 was internal-only, so the fix was to
get an internal membership to take effect or to attach 515 to Friends.

**Half of that is right and half of it is not, and the half that is wrong is the half the fix
depended on.** Apple's records, read twice today:

| Question | Apple's answer |
| --- | --- |
| Which group did the accepted invitation bind him to? | **Both.** `royearguan@gmail.com` is a member of `Internal Testers` (internal) **and** `Friends` (external). |
| How did he join? | `inviteType = EMAIL`, not `PUBLIC_LINK`. There is **no** public-link tester record on this app. |
| Has he accepted? | Yes — `state = "ACCEPTED"`. It was `INVITED` when the previous sprint ran, so the acceptance is what changed. |
| Is he a real App Store Connect team user? | Yes — `ACCOUNT_HOLDER, ADMIN`, all apps visible. So the internal membership is not decorative. |
| Is he entitled to build 515 right now? | **Yes — via `Internal Testers`.** |

So there was no internal membership to "get to take effect". It was already in effect, and it was
already serving 515 before this sprint touched anything.

### Then why did the phone say "No TestFlight builds are available"?

Because of the other half, which the brief got exactly right:

```
Friends — EXTERNAL — public link hD3KvZeC
  450  expired=true   expired 2026-07-15
  449  expired=true   expired 2026-07-14
  445  expired=true   expired 2026-07-13
  327  expired=true   expired 2026-06-27
   16  expired=true   expired 2026-06-12   ← the version the phone reported
   11  expired=true   expired 2026-06-10
```

**Every build the external group serves has expired.** TestFlight builds expire 90 days after
upload; the newest build ever attached to `Friends` is 450, from July. So `Friends` today serves
nothing installable at all, and the version string the phone showed — `1.3.1 (16)`, released
15 Mar 2026 — is simply the last build that device ever installed, sitting on a page whose
catalogue is now empty.

That is the sentence worth keeping: **the group is not stale, it is empty.** A stranger who clicks
the public link today installs nothing.

### What that means about the phone

Apple says the Apple ID is entitled to 515. Apple does not say which Apple ID that phone is signed
in as, and the API cannot tell us. So the honest reading has two branches and I will not pretend to
know which:

- If TestFlight on the second phone is signed in as `royearguan@gmail.com`, 515 is available to it
  and the screen was stale. Force-quit TestFlight, reopen, pull to refresh.
- If it is signed in as a different Apple ID, that ID is what the fix has to follow, and the four
  tester records on this app are the only candidates.

⚠️ I am not reporting "it works now" from the API alone. That is the exact mistake this sprint
exists to correct — build 515 was VALID and IN_BETA_TESTING while the screen said nothing was
available, and both were true.

---

## §2 · The prover, corrected

`build-state` answers *"is this build installable by somebody internal"*. That is not the question
the phone asks. Entitlement is **per-tester-per-group**:

```
builds this tester can install
  = builds served by every group the tester BELONGS TO
  + builds assigned to the tester INDIVIDUALLY
  - builds that have EXPIRED
```

`tools/asc/entitlement.rb` computes exactly that, and adds two checks the earlier tooling did not
have:

1. **It reads every tester record on the app, not `filter[email]`.** A public-link acceptance makes
   its own record with no email. Filtering by email would hide the one row that could explain the
   device. (On CAPS today there are four records and all four are `EMAIL` invites — so the
   public-link theory dies on this read, not on an assumption.)
2. **It cross-checks the internal group against `/v1/users`.** Apple serves internal builds only to
   App Store Connect team users. A tester row can sit inside an internal group while the Apple ID
   behind it is not on the team — real membership, absent entitlement. The script says so in those
   words when it happens. It did not happen here: all four testers are team users.

Run 15 output, verbatim verdict:

```
=== ENTITLEMENT FOR royearguan@gmail.com ===
  record d4a6f105-95d2-41ef-93f8-b45066b13caf — invite=EMAIL state="ACCEPTED"
    via Internal Testers (INTERNAL) — installable: 515, 514, 513, 512, 511, 510, ...
    via Friends (EXTERNAL) — installable: NONE (every build it serves has expired)
  individually assigned to build 515: nobody
  ✅ BUILD 515 IS AMONG THEM — via Internal Testers.
```

---
