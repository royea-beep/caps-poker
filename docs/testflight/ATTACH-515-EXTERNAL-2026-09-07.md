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

Before the change (run 15) — `Friends` served only expired builds:

```
    via Internal Testers (INTERNAL) — installable: 515, 514, 513, 512, 511, 510, ...
    via Friends (EXTERNAL) — installable: NONE (every build it serves has expired)
```

After the change (run 17), read fresh from Apple — and note that the prover does **not** let the
new attachment count as entitlement:

```
=== ENTITLEMENT FOR royearguan@gmail.com ===
  record d4a6f105-95d2-41ef-93f8-b45066b13caf — invite=EMAIL state="ACCEPTED"
    via Internal Testers (INTERNAL) — installable: 515, 514, 513, 512, 511, 510, ...
    via Friends (EXTERNAL) — installable: NONE
      515 is ATTACHED to this group but NOT delivered — READY_FOR_BETA_SUBMISSION
  individually assigned to build 515: nobody
  ✅ BUILD 515 IS AMONG THEM — via Internal Testers.
```

That is the whole sprint in six lines: the external group now lists 515 and still delivers nothing,
and the tool says so instead of celebrating its own 204.

---
## §1 · The route taken

**Route A was already true.** He is in the internal group, he is an App Store Connect team user,
and `Internal Testers` has served 515 since it finished processing. There was nothing to add and I
added nothing. ⚠️ No tester was created, removed or moved in this sprint.

**Route B's attachment half was taken anyway, and it is the one that mattered.** `Friends` was
serving nothing installable at all — not "an older build", *nothing*. Attaching 515 to it:

```
=== ATTACHING BUILD 515 TO 2 GROUP(S) ===
  Internal Testers (INTERNAL) — already serves build 515. Nothing to do.
  Friends (EXTERNAL) — attached (HTTP 204).

=== READ BACK — WHICH GROUPS SERVE BUILD 515 NOW ===
  Internal Testers (INTERNAL) — SERVES build 515
  Friends (EXTERNAL) — SERVES build 515
```

**Beta App Review has NOT been submitted, and that is deliberate.** Apple parks the build at
`externalBuildState = READY_FOR_BETA_SUBMISSION`: attached, listed, and delivered to nobody
external until review passes. Review is usually under a day and can run to a couple of days, and it
can be rejected. Submitting is a decision with a real cost and a real failure mode, so it is Roye's
to make, not mine to take quietly.

One-line dispatch when he wants it — **Actions → Manage TestFlight → Run workflow**:

```
action              distribute
build               515
groups              Friends
submit_beta_review  true
```

### ⚠️ And the trap inside the good news

Attaching returned 204 and the read-back says `Friends — SERVES build 515`. **That is not
entitlement.** If the prover had counted it, this sprint would have reproduced its own bug one
level down — a relationship that exists and an entitlement that does not. `entitlement.rb` now
reads `buildBetaDetail` for every build a group serves and only counts the ones actually being
delivered (`internalBuildState` for internal groups, `externalBuildState` for external ones).
Anything attached but withheld prints as attached-but-withheld, with the state holding it.

---

## §3 · The pipeline, fixed — and this is the real finding

`ios-testflight.yml` ends at `altool`. It has never attached a build to a beta group. Its own
header says so:

> "dropped the ASC bundle-ID registration and **beta-group distribution steps** for this first run
> … They can come back once this is green."

They never came back. The internal group hid it perfectly: it carries `hasAccessToAllBuilds = true`
and picks up every build on its own, so every CAPS build has looked healthy from the internal side
while the external group kept serving whatever was last attached by hand — build 450, in July.
**That is the difference from 9Soccer.** 9Soccer's builds are attached to both groups; CAPS's were
attached to neither, and only survived because internal does not need attaching.

New step, after the upload succeeds:

```yaml
- name: Distribute the build (export compliance + beta groups) and read it back
  env:
    DISTRIBUTE_GROUPS: "Internal Testers"
    SUBMIT_BETA_REVIEW: "false"
    WAIT_MINUTES: "30"
```

`tools/asc/ensure_distribution.rb` does four things, idempotently:

1. waits for `processingState = VALID` (up to 30 minutes)
2. answers export compliance if `usesNonExemptEncryption` is null — a null holds a build in limbo
   indefinitely and shows nothing on a phone
3. attaches the named groups, skipping any that already serve the build
4. **reads back from Apple** which groups serve it, and then reports every external group that is
   serving nothing installable

Two deliberate choices worth defending:

- **It is not `if: always()`.** A failed upload has nothing to distribute, and attaching the
  *previous* build to a group because this one failed is exactly the kind of quiet wrong action
  this repo keeps paying for.
- **It attaches internal only, and never submits for review on its own.** External attachment
  needs Beta App Review; a pipeline that submits on every push would queue reviews Roye never
  asked for. Instead every build now prints the staleness of every external group, so the problem
  that hid for three months cannot hide again.

**Proven on 515, not promised for 516.** The same script ran against 515 through the `distribute`
action and produced the output quoted above.

---

## What Roye should do now

1. On the second phone, open **TestFlight** and check the Apple ID under **Account** — it must be
   `royearguan@gmail.com`. Everything below depends on that.
2. Force-quit TestFlight, reopen, pull down to refresh on the CAPS page.
3. Expect **CAPS 2.7.0 (515)** with an **Install** button. That is the internal entitlement, and it
   needs no review and no waiting.
4. If it still shows nothing: the phone is signed in as a different Apple ID. Say which one and
   the fix follows that account instead.
5. Separately, decide on the public link. It currently installs nothing for anyone. One dispatch
   with `submit_beta_review: true` starts the review; expect under a day, possibly two.

⚠️ Plugging the iPhone into a computer still will not help. TestFlight distribution is an
account-and-group relationship on Apple's servers, not a file on a cable.

---

## Ledger

| Item | State |
| --- | --- |
| Group the accepted invitation bound him to | Both — `Internal Testers` and `Friends`, invite type `EMAIL` |
| Why the phone showed build 16 | `Friends` served only expired builds; 16 was the last one that device installed |
| Route used | A was already in effect; B's attachment done, B's review NOT submitted |
| Beta App Review | Not submitted. Under a day typically, up to a couple of days, can be rejected |
| Apple's records after | `Internal Testers` and `Friends` both serve 515 |
| Is 515 among Roye's entitlements | Yes, via `Internal Testers`, unblocked and un-reviewed |
| Prover updated for per-tester entitlement | Yes — plus team-user cross-check and attached-vs-delivered |
| Pipeline fixed | Yes — `ios-testflight.yml` now distributes and reads back |
| Proven on 515 | Yes, run 16 |
| 9Soccer | Untouched. Read only, and not even read this sprint |
| Testers added / removed / modified | None |
| Metadata, pricing, availability | Unchanged |
