# The public link installs nothing — the choice, and the pipeline proof

**Date** 2026-09-07 · App `6760429619` / `com.capspoker.app` · read from App Store Connect.

---

## What the link does right now, in one sentence

**Anyone who clicks the CAPS TestFlight public link today joins the "Friends" group and is offered
nothing to install, because build 515 is attached to that group but has not passed Beta App
Review — and every other build the group holds has expired.**

That is worse than a dead link. A dead link fails visibly. This one succeeds, adds the person as a
tester, and then shows them an empty page — which reads as a broken product rather than a closed
one.

## How it got that way

| Build in `Friends` | Expired | Expiry |
| --- | --- | --- |
| 450 | yes | 2026-07-15 |
| 449 | yes | 2026-07-14 |
| 445 | yes | 2026-07-13 |
| 327 | yes | 2026-06-27 |
| 16 | yes | 2026-06-12 |
| 11 | yes | 2026-06-10 |
| **515** | no | 2026-12-06 — **attached, `READY_FOR_BETA_SUBMISSION`, not delivered** |

TestFlight builds expire 90 days after upload, the newest build ever attached by hand was 450 in
July, and nothing in the pipeline ever attached another. 515 was attached yesterday by the
`distribute` action, which is why the group is no longer empty — but attaching is not delivering.

## The two options, and the real trade-off

⚠️ **Nothing has been submitted. This is Roye's call and I have not made it.**

**A · Submit 515 for Beta App Review, and the link works.**

- Cost: a review queue with his name on it. Apple publishes no SLA. In practice **under a day is
  typical, up to two days happens**, and it **can be rejected** — most often for missing test
  credentials or an unclear "what to test" note.
- Once approved, the link installs 2.7.0 (515) for anyone who clicks it, and later builds of the
  **same version** usually clear review without a fresh wait.
- One dispatch: **Actions → Manage TestFlight → Run workflow**, `action: distribute`,
  `build: 515`, `groups: Friends`, `submit_beta_review: true`.

**B · Disable the public link until there is a reason for one.**

- Cost: nothing. No review, no wait, no rejection.
- It removes the broken-looking front door. Nobody is currently arriving through it — there is
  **no public-link tester record on this app at all**; every one of the four testers came from an
  email invitation.
- One dispatch: **Actions → Manage TestFlight**, `action: enable-public-link` is the switch that
  turns it on; turning it off is the same field set to false in App Store Connect under
  TestFlight → Friends → Public Link.

**Which way the facts lean.** The round Roye has decided on is testers he invites by name. A
public link serves strangers, and there are none. Option B costs nothing and removes a bad first
impression today; option A spends a review on a door nobody is currently walking through. But B is
a decision to stay closed, and that is a product call, not a technical one.

## ⚠️ The pipeline fix, proven by running it — not by reading the workflow

Before: `ios-testflight.yml` ended at `altool`. It had **never** attached a build to any group.
Its own header records that the distribution steps were dropped "for the first run" and they were
never restored. The internal group hid it by collecting every build on its own.

Now the step is one line — `bash tools/asc/distribute_current_build.sh` — with
`DISTRIBUTE_GROUPS` **blank, meaning every group**, internal and external.

The reason it is a script and not inline YAML is exactly so this claim can be tested: a step that
only ever runs at the end of a twenty-minute archive is a step nobody can check. The new
`pipeline-distribute-selftest` action runs **that same file with the same environment the build
workflow gives it**. Run 18, output verbatim:

```
distributing build 515 (read from app.json, not typed)
=== ATTACHING BUILD 515 TO 2 GROUP(S) ===
  Internal Testers (INTERNAL) — already serves build 515. Nothing to do.
  Friends (EXTERNAL) — already serves build 515. Nothing to do.

=== READ BACK — WHICH GROUPS SERVE BUILD 515 NOW ===
  Internal Testers (INTERNAL) — SERVES build 515
  Friends (EXTERNAL) — SERVES build 515

RESULT: build 515 is served by Internal Testers, Friends.

=== EXTERNAL GROUPS — ARE THEY STALE? ===
  Friends — current (serves 515).
```

It read the build number out of `app.json`, resolved **both** groups without either being named
in the workflow, found them already attached, and confirmed it by reading Apple back rather than
trusting a 200. Re-running is a no-op, which is what a pipeline step has to be.

⚠️ **What that does and does not prove.** It proves the script, the group resolution, the build
number, and the Apple calls — everything the step does. It does **not** prove the step fires
inside a real archive job, because that needs a build, and a build needs a version bump nobody
asked for this sprint. The step is now literally the same line the selftest ran, so what is
untested is the ordering, not the behaviour. The first honest confirmation is build 516.
