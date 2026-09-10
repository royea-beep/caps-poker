# DELETE-THE-LIAR — 2026-09-08

`.github/workflows/ios-testflight-DISABLED.yml` is deleted. Nothing else was deleted.
No app code touched: no economy, no flag, no cue, no layout, no card size, no 83px arc.
No Edge Function deployed. No build dispatched. No dollar figure claimed.

---

## §1 — WHICH WORKFLOW ACTUALLY BUILT 515

**`.github/workflows/ios-testflight.yml`** — established from the run record and the commit it
built, not from the name.

| | |
|---|---|
| run | 1227, id `34107249013`, `workflow_dispatch` on `main` |
| conclusion | **success**, 2026-09-07 09:39:25Z → 09:53:29Z |
| head sha | `b8b7ae1a3` |
| that commit's message | "Build number bumped to 515 in the same range; 514 is on TestFlight" |

And the build number is not taken from the commit message either. The workflow's step *"Read
version + build number from app.json"* runs `node -p "require('./app.json').expo.ios.buildNumber"`
(line 72), and `git show b8b7ae1a3:app.json` reads **`ios.buildNumber: 515`**, version `2.7.0`. The
input the workflow actually consumes says 515.

It is not a one-off: the same workflow has succeeded for **509, 510, 511, 512, 513, 514 and 515**,
seven consecutive dispatches.

## §1 — NOTHING REFERENCES THE DELETED ONE

Checked three ways:

- **No workflow invokes it.** There is no `workflow_call` anywhere in `.github/workflows/`, and no
  `uses: ./` local-workflow reference anywhere. It could only ever run by manual dispatch.
- **No script or config names it.** The only hits repo-wide are seven prose mentions, all
  historical: `MEMORY.md:951`, `docs/BUILD-508-2026-08-28.md:91`, `CLAUDE.md:206`,
  `docs/handoffs/HANDOFF-199.txt:84`, `docs/infra/CLOSE-THE-THREE-2026-09-08.md:160`, and two lines
  in `ios-testflight.yml`'s own header.
- **Nothing dispatches it by display name** either — a grep for its GitHub workflow name returns
  only the file itself.

## §1 — THE STATED CONDITION FOR KEEPING IT WAS MET, AND IT HAD NEVER RUN

`ios-testflight.yml`'s header said it outright:

> *ios-testflight-DISABLED.yml is deliberately KEPT until this one produces a successful build, so
> there is a diff to compare against when something breaks.*

That condition was satisfied seven times over. And the file itself:

**`total_count: 0`. It has never run once, in its entire existence.**

Meanwhile GitHub listed it as `state: "active"` and it carried a live `workflow_dispatch:` trigger.
Its own header calls its signing certificate revoked (`45EBC138DF94E77658BA9558EAAE19FC`), and it
still imports a p12 from `BUILD_CERT_P12_BASE64` and runs the archive. A file named DISABLED that
anyone could fire, into an app where Apple hard-limits roughly ten uploads per day.

**Deleted.** The two header lines in `ios-testflight.yml` that named it were rewritten in the same
commit: leaving a comment pointing at a file that no longer exists is the very defect this sprint
is closing. The header now records which builds that workflow produced, how that was checked, and
where the diff still lives: `git show 9577aa5:.github/workflows/ios-testflight-DISABLED.yml`.

YAML re-parsed after the edit: one job, `workflow_dispatch` trigger, name unchanged.

---

## §2 — SIBLING SWEEP: NAMES THAT LIE ABOUT THEIR STATE

Nothing below was changed. Reported for Roye.

### ⚠️ Two workflows exist on GitHub with no file in the repository

`asc-details.yml` ("ASC Build Details", id `276765913`) and `asc-list.yml` ("ASC List Builds", id
`256838216`) are both listed by GitHub as **`state: "active"`**. Neither file exists in the working
tree, on `origin/main`, or as a single object anywhere in this clone's history. They show in the
Actions UI as available workflows backed by nothing. This is the same class inverted — the *listing*
asserts a state the *repository* does not have.

### ⚠️ `ios-testflight-free.yml` — the name promises a path that cannot work

Named "iOS TestFlight (FREE — macOS runner, no EAS cloud)", and its step at line 92 runs
`eas build`. `ios-testflight.yml`'s own header states the Expo account is disabled and is not
coming back. Its last run was **run 59, 2026-06-25**, and nothing has used it since. It is also
what the deleted file's header called its replacement — which was already untrue, since the real
replacement is `ios-testflight.yml`.

### ⚠️ `ios-simulator-smoke.yml` runs `eas build` on **push**

Line 82. Same dead Expo account, but this one has a `push` trigger rather than being manual.

### ⚠️ `variant="gold"` is still live on two buttons

`app/simulate.tsx:232` and `:323`. `components/Button.tsx:192` calls that variant "the de-facto
primary CTA", and it has painted MINT since the theme sweep. The route redirects to Home, so
nobody sees it — the string is still a name asserting a colour it does not paint.

### ✅ Checked and NOT a liar

`KILL_Board` / `KILL_game` in `utils/animationKill.ts`. `KILL_FINITE_ON_THIS_PLATFORM = true`, so
the name matches the state. The comment at line 43 that reads "With `KILL_Board` false on web" is a
historical account of a shipped experiment, and line 62 records that it was reverted. Honest
history, not a stale claim. Withdrawn as a finding.

`auto-fix-crashes.yml` and `claude-fix.yml` carry `schedule` and `repository_dispatch` triggers in
their files but are `disabled_manually` at the GitHub level. The mismatch runs in the safe
direction — the file claims more than the platform allows — so they cannot fire.

---

## §3 — SUCCESSFUL BUILDS PER DAY, BEFORE AND AFTER THE IGNORE RULE

Counts only. No dollar figure; this session has no billing access.
Re-measured today rather than carried over from handoff 199. The numbers did not move.

Every successful run below is a real container: `expo export`, a Playwright install, a WCAG audit,
BackstopJS and `vercel --prod`. Failed and cancelled runs allocate nothing.

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

### ⚠️ THEY DID NOT DROP. THE RULE STILL HAS NOT FIRED — AND NOTHING UNKNOWN IS TRIGGERING BUILDS.

The brief said: *"If they did not drop, say so plainly. That would mean something is still
triggering builds and we have not found it."* They did not drop, and the cause is known, not
missing:

- `git show origin/main:.github/workflows/web-deploy.yml` still reads `branches: [main, master]`
  with **no `paths-ignore` at all**. Re-checked today after a fresh fetch.
- `ec17b41`, which added it, is **not an ancestor of `origin/main`**. `origin/main` is still
  `8606d64`.
- The newest Web Deploy run of any kind is still **2026-09-08 07:39:12Z**, on `main`, the same one
  as yesterday. The rule was committed at **08:25:34Z** — 46 minutes later. No run has started
  since, so nothing unaccounted-for is triggering builds; there have simply been no pushes to main.

The 7 → 1 between 09-07 and 09-08 is a quiet day, not a saving.

**What the rule would save, recomputed from the same 100 runs:** of **70 successful runs, 24 (34%)**
had a head-commit diff consisting entirely of `docs/**` or `**/*.md`. Aimed correctly. Saved
nothing yet.

**The check that will settle it:** after the next merge to `main`, a docs-only push must show NO
Web Deploy run. Until that is observed, the rule is untested in production.
