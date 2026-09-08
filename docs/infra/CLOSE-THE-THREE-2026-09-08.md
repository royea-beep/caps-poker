# CLOSE-THE-THREE — 2026-09-08

Three infrastructure items from the account-manager report. All three answered from measurement.
Nothing in the app was touched: no economy, no flag, no cue, no layout, no card size, no 83px arc.
No Edge Function was deployed. No credential was rotated or revoked.

---

## §1 — THE SECRET GUARD

### ⚠️ CORRECTION: it was not missing. Both halves have existed since 2026-09-06.

The brief said a guard "was recommended and it never was" added. That is not what the repository
holds. `secret scan: clean` has been printing on every commit in this session, so it was traced
rather than accepted:

| piece | path | added |
|---|---|---|
| the detector | `scripts/scan-secrets.mjs` | `41b534d`, 2026-09-06 03:22 UTC |
| the local hook | `.githooks/pre-commit` (`core.hooksPath=.githooks`) | same commit |
| the CI check | `.github/workflows/secret-scan.yml`, on `push` and `pull_request` | same commit |

**Both, and here is why both.** The hook is the fast local refusal — it costs nothing and it
refuses before the bad object ever exists. It is also skippable with `--no-verify`. The workflow
runs on every push and every pull request and cannot be skipped from a laptop. The workflow's own
header already said this; the hook's comment asserted the workflow existed, and that assertion was
checked against the file rather than believed.

### ⚠️ Two real holes were found in it, and both are closed.

**1. The hook read the WORKING TREE, not the index.** `git add secrets.ts` followed by editing the
secret back out of the file would have walked straight past it: the index still carried the token,
and the index is what `git commit` writes. `--staged` now reads `git show :<path>`.
Proven: staged three files carrying a token, scrubbed all three worktree copies, `git commit`
still exited 1 and HEAD did not move.

**2. A path with parentheses made git never run, and the failure was SILENT.** The first version of
the `--rev` mode interpolated paths into a shell string. `app/(tabs)/index.tsx` — the app's
2,475-line home screen — is a real path in this repository, and parentheses are shell syntax. git
died with `Syntax error: "(" unexpected`, the throw was swallowed by the caller's `catch`, and the
file was skipped. A scanner reporting "clean" while never having opened the biggest screen in the
app. Every git call now goes through `execFileSync` with an argument array. Caught by watching the
output, not by a test.

**3. A fresh clone did not get the hook at all.** `core.hooksPath` is local git config and nothing
installed it — the workflow's header said so and it was true. `package.json` now carries
`"prepare": "git config core.hooksPath .githooks || true"`. Proven by unsetting the config,
running `npm run prepare`, and reading it back as `.githooks`.

### PROVEN TO FIRE — on the real leak, not only on a synthetic

`--rev <sha>` replays the guard over one past commit, reading each file's bytes at that commit.
Run against the two commits that actually leaked the Telegram bot token:

```
a40ea15  2026-06-17  BLOCKED  docs/MASTER_INDEX.md                          -> Telegram bot token
345c327  2026-07-15  BLOCKED  docs/MASTER_INDEX.md                          -> Telegram bot token
                     BLOCKED  supabase/functions/retriage-pending/index.ts  -> Telegram bot token
```

Both exit 1. **`docs/MASTER_INDEX.md` is the first line of both** — the doc half of the leak, which
a source-only scanner would have missed entirely.

### PROVEN TO FIRE — on an actual commit attempt, in all three file types

A realistic fake Telegram token was written into a `.ts`, a `docs/**.md` and a `.json`, staged, and
`git commit` was run for real:

```
  BLOCKED  _guardproof.json             ->  Telegram bot token
  BLOCKED  docs/_guardproof/NOTE.md     ->  Telegram bot token
  BLOCKED  utils/_guardproof.ts         ->  Telegram bot token
git commit exit=1     HEAD unchanged at af20d13
```

`docs/` and JSON are in scope because the scanner walks `git ls-files` minus vendored directories
and binaries, not a source allowlist. The three files were removed afterwards; nothing was left in
the tree. The scanner prints the FILE and the KIND, never the matched value.

### FALSE-POSITIVE RATE — 0 on 818 ordinary commits

`tests/secret-scan-falsepos.mjs` replays the guard over the last N commits.

| | |
|---|---|
| commits scanned | 820 (of the last 900; merges and empty diffs skipped) |
| files scanned | 4,142 |
| commits blocked | 2 |
| **false positives** | **0** |
| block rate | 0.2%, and both blocks are the real leak above |

Both refusals are `a40ea15` and `345c327`. Nothing else in 900 commits of real work was refused.
The sweep is now a CI step (25 commits, `fetch-depth: 30`) so the number stays live rather than
being a measurement taken once. It reports and does not fail the job: a genuine credential in
recent history SHOULD show up there.

### THE CURRENT TREE — CLEAN

`node scripts/scan-secrets.mjs` over every tracked file: **`secret scan: clean`**. Nothing to
rotate, and nothing was rotated.

⚠️ **History is a different question and is unchanged.** `a40ea15` and `345c327` still contain the
token in git history; that is what the 2026-09-06 rotation was for. A committed credential is a
disclosed credential and deleting it later does not remove it from history — only the revoke that
already happened protects it.

The detector ignores the Supabase **anon** key on purpose: it is public by design and ships in the
app bundle. Only a `service_role` JWT is a finding, and that is decided by base64url-decoding the
payload and reading `role`, not by a prefix. The self-test asserts both directions — six positives
detected, and the live anon key plus the `.env.example` placeholder ignored.

---

## §2 — THE ROOT `vercel.json`

### DECISION: KEPT, AND LABELLED IN THE FILE ITSELF.

**Who reads it, checked rather than assumed:**

| reader | reads it? |
|---|---|
| the production deploy (`web-deploy.yml` → `vercel --prod` from `dist/`) | **no** — it serves `dist/vercel.json`, written by `scripts/fix-web-html.js` |
| Vercel's Git integration | **yes** — it validates this file's schema on every push, which is how a `_comment_rewrites` key failed 29 of 40 deploys |
| `vercel dev` | never run here — no npm script, no workflow, no doc invokes it |
| `tests/vercel-rewrites.test.ts` | yes |
| any other script or workflow | no — every other hit is a comment or a doc paragraph about it |

**Why it was not deleted.** Its `buildCommand` is a working build of this app: it exports to
`web-dist`, and `scripts/fix-web-html.js` accepts both `dist/` and `web-dist/`, so the export and
the patch agree. That makes it the correct fallback if the project's Ignored Build Step is ever
switched off. Deleting it would swap a labelled trap for a silent zero-config deploy of the
repository root onto the production domain.

**How it is labelled, given that JSON has no comments.** The warning is the VALUE of
`installCommand`, which is now the file's first key. It is a legal string in a legal field, not a
new property, so the closed schema is untouched — and it prints into the build log of any deploy
that ever does use this config, which is the exact moment somebody needs to read it. It still ends
in `npm install`; proven by running the whole chain under `/bin/sh`.

Four new tests in `tests/vercel-rewrites.test.ts` hold it: still installs, carries the warning,
is the first key, and contains no quote or backtick that could break the shell. Two of the four
were proven to fail by putting the defect back — stripping the warning, and planting an apostrophe.

⚠️ **A note beside a trap is not a label on it.** `scripts/fix-web-html.js` has carried "the root
vercel.json is never read in prod" in a real comment since 2026-08-15. It did not stop the 404 fix
going into the root file on 2026-09-03, and it did not stop me repeating the mistake.

### THE CLASS: other files edited by people but ignored by production

Swept deliberately. Findings:

- ✅ **No shadow copies exist right now.** `privacy.html` and `terms.html` live only at the repo
  root; `public/privacy.html` and `public/terms.html` would be silently overwritten by
  `fix-web-html.js` and neither exists. Same for `web-dashboard/index.html` → `dist/bugs/` and
  `web-replay/index.html` → `dist/hand/`. `tests/privacy-page.test.ts` already asserts this.
- ✅ **No generated output is tracked.** Zero files under `dist/`, `web-dist/`, `ios/` or
  `android/` are in git, so there is no hand-edited copy for a build to blow away.
- ✅ `tests/visual/baselines/` is absent, not empty — already recorded in CLAUDE.md; the only
  baselines CI compares are `backstop_data/bitmaps_reference/`.
- ⚠️ **`.github/workflows/ios-testflight-DISABLED.yml` is dispatchable.** The name says DISABLED
  and only the `push` trigger was removed: `workflow_dispatch` is still there, and the workflow
  signs with cert serial `45EBC138DF94E77658BA9558EAAE19FC`, which its own header calls revoked.
  Anyone reading the file list would believe it cannot run. **Reported, not changed** — deleting a
  fallback workflow is Roye's call.
- ⚠️ **`.github/workflows/ios-simulator-smoke.yml` runs `eas build` on push.** `ios-testflight.yml`
  states the Expo account is disabled and is not coming back. Reported, not changed.

---

## §3 — DID BILLING ACTUALLY DROP

### ⚠️ NO. THE IGNORE RULE HAS NEVER FIRED, AND IT CANNOT HAVE.

Counts only. No dollar figure is claimed; this session has no billing access.

**Successful Web Deploy runs per day** — each one runs `expo export`, a Playwright install, a WCAG
audit, BackstopJS and `vercel --prod`, and each is a real container. 100 most recent runs:

| day | success | failure | cancelled | total |
|---|---|---|---|---|
| 2026-08-22 | 16 | 0 | 4 | 20 |
| 2026-08-23 | 13 | 7 | 3 | 23 |
| 2026-08-27 | 14 | 1 | 7 | 22 |
| 2026-08-28 | 2 | 0 | 2 | 4 |
| 2026-08-30 | 3 | 0 | 1 | 4 |
| 2026-08-31 | 3 | 0 | 0 | 3 |
| 2026-09-01 | 6 | 0 | 1 | 7 |
| 2026-09-02 | 4 | 0 | 1 | 5 |
| 2026-09-05 | 1 | 0 | 0 | 1 |
| 2026-09-07 | 7 | 0 | 3 | 10 |
| 2026-09-08 | 1 | 0 | 0 | 1 |

**Why the 7 → 1 is not the rule working:**

- `paths-ignore` was committed in `ec17b41` at **2026-09-08 08:25:34Z**.
- The last Web Deploy run started at **2026-09-08 07:39:12Z** — **46 minutes before the rule
  existed**.
- `paths-ignore` fires only on pushes to `main`. `ec17b41` and `bc2a94d` are on
  `claude/vamos-caps-align-celebration-flppo0` and are **not ancestors of `origin/main`**.
  `git show origin/main:.github/workflows/web-deploy.yml` still reads `branches: [main, master]`
  with no `paths-ignore` at all.
- There have been no pushes to `main` since. The 1 is a quiet day, not a saving.

**What the rule WOULD have saved, measured on the same history.** For each successful run, the
head commit's own diff was classified: does every changed file match `docs/**` or `**/*.md`?

| | |
|---|---|
| successful runs judged | 70 |
| runs whose entire diff was docs or markdown | **24 (34%)** |

So the rule is aimed correctly — a third of successful builds published a byte-identical bundle —
but it has saved nothing yet, and it will not until it reaches `main`.

**The red deploys still cost nothing.** Re-confirmed from the deployment record: the Git-integration
failures have `buildingAt == ready == createdAt` and no build-log events, so no container is
allocated. Since `ec17b41` every Git-integration deploy is `CANCELED` by the Ignored Build Step,
which is the intended state.

**⚠️ The first thing to check after the next merge to main:** a docs-only push to `main` must show
NO Web Deploy run. Until that is seen, the ignore rule is untested in production.
