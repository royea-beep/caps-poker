# RPT-CAPS-002 — the schema error, the guard that blessed it, and whether Git publishes

**2026-09-10 · repo `royea-beep/caps-poker` · Vercel `caps-poker-web` (prj_Xs2oTTRhOc0AXKiiJhzy4dRo3juP)**

## The headline: the hypothesis was right about `_comment_rewrites` and wrong about the cause

Roye's reading of `origin/main` was correct on every point he made. There is no
`_comment_rewrites` property on any active branch, and the only `_comment` match is inside the
`installCommand` **string value**. He was also right that `main` carried the bad file at 07:31.

**But the merge did not fix it, and the deploys are still failing.** The newest `main` deploy —
`dpl_HrRX99zz`, commit `f4edc75`, 13:12Z, *after* the merge — is ERROR with a **different**
message:

```
The `vercel.json` schema validation failed with the following message:
`installCommand` should NOT be longer than 256 characters
```

Commit `9577aa5` (2026-09-08 17:10) removed the `_comment_rewrites` key **and, in the same
commit, moved the prose into the `installCommand` value** as a chain of `echo` segments —
**1,158 characters**. Vercel caps that field at **256**. Moving prose from a key to a value does
not remove it from the file. Two outages, five days apart, from one instinct.

## 1 — vercel.json per branch: property vs string, distinguished by parsing

| branch | `_comment*` **properties** | `installCommand` length | verdict |
|---|---|---|---|
| `origin/main` | 0 | **1,158** | ✗ over by 902 |
| `claude/vamos-caps-align-celebration-flppo0` | 0 | **1,158** | ✗ over by 902 |
| `claude/caps-001-audit` | 0 | 11 | ok |
| `qa/backstop-baseline-refresh` | 0 | 11 | ok |

Measured by `json.load` + walking the key tree, not by grep. On `main` the raw text contains
`_comment` exactly once, at `$.installCommand` — a **string value**, which validates fine. Zero
occurrences of `_comment_rewrites` anywhere.

**The 07:31 failure, exactly.** `dpl_9gfLwKEvq4eReja3XUeyA9oke6An` was on branch
`claude/caps-deep-audit-nr8z17`, commit `3579e67`, `target: null` — a **preview**, not
production. Its `vercel.json` did carry a real `_comment_rewrites` **array** property. So the
07:31 error message was accurate for that commit. `main` at the time (`ef55640`) carried the
property too; the removal (`ec17b41`, 09-08) reached `main` only via the celebration merge
`48cbf47` at 12:54Z.

## 2 — real deploy triggered, status read from Vercel

Pushed `23c5ee3` to `claude/caps-deep-audit-nr8z17` at 17:23Z with the fix.

| deploy | commit | before/after | state |
|---|---|---|---|
| `dpl_9gfLwKEvq4eReja3XUeyA9oke6An` | `3579e67` | before | **ERROR** (comment key) |
| `dpl_HrRX99zzCHk4HL2GdFhfdTqwYGGz` | `f4edc75` | after the merge | **ERROR** (256 cap) |
| `dpl_FhLVfDP1fVZhh9JXc2GsiaKLxMbL` | `23c5ee3` | after the fix | **CANCELED** |

**CANCELED is the correct healthy state, not a failure.** The project's Ignored Build Step is
supposed to skip Git-integration deploys — and schema validation runs *before* it. With the file
valid, validation passes and the Ignored Build Step finally gets to run. That is the state the
root `vercel.json` comment itself predicted.

## 3 — why the CI check did not catch it

`tests/vercel-rewrites.test.ts`, added by `9577aa5`. **It validates the ROOT file and the
GENERATOR's source text — both.** That part is not the hole. Three other things are:

1. **It checks key NAMES against a hand-typed allowlist and never a value's LENGTH.** A schema
   constrains values too, and that is where the second outage lived.
2. **It pins the violation in place.** Four assertions in its `the root vercel.json labels
   itself` block *require* the three warning phrases to be present in `installCommand`.
   Shortening the string to fix the deploy would have failed the guard.
3. **No workflow ran it.** `jest` appears in `.github/workflows/claude-fix.yml` and nowhere else.
   `web-deploy.yml` has no test step at all.

**Measured, not argued:** run on the file Vercel was refusing, it reported **56 of 56 passing** —
including a test named *"the root vercel.json carries no key Vercel would reject."*

### Made to fail on a planted defect — three shapes, all refused

New: `scripts/check-vercel-config.mjs`, wired into `.github/workflows/vercel-config-check.yml`,
which runs **on every push to every branch** — where the Git integration fires. `web-deploy.yml`
could not have covered it: it skips docs-only pushes via `paths-ignore`, and both recent failures
were docs-only commits on `main`.

```
✗ vercel.json (root): should NOT have additional property `_comment_rewrites`          exit 1
✗ vercel.json (root): `installCommand` should NOT be longer than 256 (it is 1342)      exit 1
✗ dist/vercel.json (GENERATED): should NOT have additional property `_comment`         exit 1
✓ restored                                                                             exit 0
```

`--self-test` runs first in CI and blocks, so a checker broken into always-pass fails the run
rather than blessing it. First run of the new workflow: **conclusion `success`** (run 34507925915).

### Generator checked — can prose reach the file production serves?

**Not today, and now asserted rather than assumed.** `dist/vercel.json` is `JSON.stringify` of an
object literal in `scripts/fix-web-html.js` with exactly two keys, `rewrites` and `headers`. It
has no `installCommand`, so the 256 cap cannot bite there. A `_comment:` property added to that
literal **would** ship — that is plant 3 above, and the checker refuses it.

## 4 — is the site publishing FROM GIT?

**Yes.** The `gitRootDirectory=dist` signature is not a hand deploy — it is the GitHub Actions
CLI deploy from the `dist/` subdirectory. Proven by the workflow run, not by the metadata alone:

- `Web Deploy (Vercel)` run **1637**, event `push`, branch `main`, commit `6a50647`,
  conclusion **success** → produced READY deploy `dpl_HvmTFy7CkHfBRVriuGvB5F3UGHkq`.

So there are **two independent deploy paths** on one project, and only one was ever broken:

| path | fires on | status |
|---|---|---|
| GitHub Actions `web-deploy.yml` → `vercel --prod` from `dist/` | push to main/master, non-docs | **working — this is what publishes** |
| Vercel Git integration | every push, every branch | was red since 09-03; now CANCELED as designed |

`f4edc75` and `b3ceac1` were docs-only, so `paths-ignore` correctly skipped `web-deploy.yml` —
only the Git integration fired, and it errored. That is the whole of the "8 ERROR of 11" reading.

### Live site verified by content, not by hash

```
content-security-policy: frame-ancestors 'none'   x-frame-options: DENY
x-content-type-options: nosniff                   referrer-policy: strict-origin-when-cross-origin
/definitely-missing-abc123.html -> 404, 79 bytes   (was 200 + 1,902 bytes of app HTML)
/nope.png                       -> 404, 79 bytes
/nope.mp4                       -> 404, 79 bytes
/  /leaderboard  /shop          -> 200
```

All four headers and the dotted-path 404 exclusion exist **only** in the generated config. Their
presence live is positive proof that `dist/vercel.json` is what serves — the root file is not.

⚠️ **My change produces no bundle delta and I will not claim one.** It touches `vercel.json`,
`scripts/`, `.github/` and `docs/` — none of which are bundled. The content assertions above
prove which config is live; they do not prove my commit shipped, because it does not reach the
bundle.

## What is NOT done

- **The fix is on `claude/caps-deep-audit-nr8z17`, not on `main`.** `main` still carries the
  1,158-character `installCommand` and its Git-integration deploys will keep going red until the
  branch is merged. I did not merge: no permission to push to `main` was given in this brief.
- **`fin_reports` write-back could not be performed.** There is no `fin_reports` table on the
  CAPS Supabase project, no endpoint referenced anywhere in the repo, and **no secret arrived in
  any message in this session**. I did not invent a target. Nothing was committed, logged or
  echoed, because there was nothing to handle. The rotation warning still stands on its own
  terms: a secret transmitted in chat should be rotated regardless of whether it reached me.

## Three ranked next steps

1. **Merge this branch to `main`** — it is the only thing standing between the diagnosis and a
   green dashboard. One merge; the Git-integration deploys go CANCELED instead of ERROR.
2. **Decide whether the Vercel Git integration should be connected at all.** It has never
   published this site; `web-deploy.yml` does. Disconnecting it removes a permanently noisy
   signal and the whole class of failure. Keeping it means keeping the config valid forever.
3. **Wire the jest suite into a workflow.** `claude-fix.yml` is the only place `jest` runs, so
   2,888 tests across 58 suites currently gate nothing on push.
