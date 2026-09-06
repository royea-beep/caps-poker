# TOKEN ROTATION — 2026-09-06

A live credential sat in a public repository and someone used it. This is what happened, what was
done, and what else the sweep found.

Branch `claude/vamos-caps-align-celebration-flppo0`. Nothing revoked beyond the token Roye had
already revoked. No economy, flag, cue, layout or navigation change.

---

## THE INCIDENT

The `@caps_bug_bot` Telegram token was committed in plaintext, in a **public** repository, in two
places:

| Path | Introduced | Commit | Days public |
|---|---|---|---|
| `docs/MASTER_INDEX.md` (token **and** chat id) | 2026-06-17 | `a40ea15` | 81 |
| `supabase/functions/retriage-pending/index.ts` | 2026-07-15 | `345c327` | 53 |

Anyone who read the repository had full control of the bot: rename it, read every bug report
submitted through it (free text, device ids, breadcrumbs), send messages as it, delete messages.
They chose to plant an advert. Roye revoked the token via BotFather before this sprint began.

### ⚠️ THE REVOKE KILLED THE ACCESS. IT DID NOT UNDO THE DEFACEMENT.

`getMe` on the **new** token, run today, returns the bot's live profile:

```
ok: true
username:   caps_bug_bot          <- ours
first_name: BEST CASINO MINI-APP @Xstakerobot   <- STILL THE ATTACKER'S TEXT
```

The username and the messages are ours; the **display name every tester will see is still the
advert**. Rotating the token cannot change that — the name is bot profile state, not credential
state. It needs one command to BotFather (`/setname`, then `/setdescription`). **That is a brand
decision and it is Roye's, so it was not done here.** It blocks the tester round as surely as the
token did.

---

## 1 — THE NEW TOKEN

**Secret set:** `TELEGRAM_BOT_TOKEN`, in the Supabase **vault**, confirmed by listing names only:

```
CAPS_BUG_BOT_TOKEN   len 46   created 2026-05-24    <- the REVOKED token, still stored
CAPS_BUG_CHAT_ID     len 10   created 2026-05-24
TELEGRAM_BOT_TOKEN   len 46   created 2026-09-06    <- the new one
```

The value was never written to a file, a commit, a doc, a log line or this handoff, and is not
printed anywhere in this document.

### ⚠️ WHY THE VAULT AND NOT AN EDGE FUNCTION ENV VAR

Setting a Supabase **Edge Function secret** (`Deno.env`) needs the Management API or the dashboard,
and **no management credential exists in this environment** — no `SUPABASE_ACCESS_TOKEN`, and the
CLI cannot authenticate. The vault is reachable from SQL, is the mechanism this project already
uses for these exact credentials (`get_caps_bug_telegram_config()`, added 2026-05-24), and has one
real advantage: changing it updated the already-deployed `analyze-bug-report` **with no redeploy**,
which sidesteps the management API's habit of resetting `verify_jwt`.

To also set the env var, when wanted:
`supabase secrets set TELEGRAM_BOT_TOKEN=<value> --project-ref gxrpunvhjcrzqnitbqah`

### The read path fails loudly

`get_caps_bug_telegram_config()` now reads `TELEGRAM_BOT_TOKEN` and **raises** if it is missing or
blank. There is deliberately **no fallback to `CAPS_BUG_BOT_TOKEN`** — that row still holds the
revoked token, and falling back onto it would look exactly like working while delivering nothing.
Verified: the function serves the new value and not the old one.

---

## 2 — THE PURGE

- **`retriage-pending`** — the literal is gone. It reads the vault first, then
  `Deno.env.get('TELEGRAM_BOT_TOKEN')`, and **throws** if neither yields a token.
- **`docs/MASTER_INDEX.md`** — token **and** chat id removed, replaced by the secret names and the
  read path, plus a note saying what happened. Not a "redacted" copy showing the prefix.
- **`analyze-bug-report`** and **`telegram-bot-handler`** — both moved onto the same vault-first
  path. `telegram-bot-handler` read the token straight from the `TELEGRAM_BOT_TOKEN` env var, which
  still holds the revoked value, so every reply from it would have silently failed.

### ⚠️ VAULT FIRST, ENV SECOND — THE ORDER IS LOAD-BEARING

An Edge Function secret named `TELEGRAM_BOT_TOKEN` already existed (for `telegram-bot-handler`) and
holds the **dead** token. The first version of this fix preferred the environment, which would have
quietly reinstated the revoked credential the moment it shipped. Caught before deploy. The vault is
the copy that was actually rotated, so the vault wins.

### Functions redeployed

| Function | Version | `verify_jwt` | Note |
|---|---|---|---|
| `analyze-bug-report` | 22 | true (preserved) | trigger presents the anon JWT |
| `retriage-pending` | 11 | false (preserved) | old literal now gone from the cloud copy too |
| `telegram-bot-handler` | 29 | false (preserved) | Telegram webhook — cannot send a JWT |

`verify_jwt` was passed explicitly on every deploy. A previous sprint lost it to the management
API's default.

### ⚠️ THE OLD TOKEN IS IN GIT HISTORY FOREVER

Removing it from HEAD does not remove it from the past. Anyone with a clone, a fork, or a cached
GitHub view still has it. **The revoke is what protects; the purge only prevents the next leak.**
History was not rewritten — it is shared, and the revoke already removed the danger.

### End-to-end proof

Two real bug reports submitted through the app's own insert path, trigger fired, both delivered:

| Report | Status | AI triage | `telegram_notified` | `metadata.telegram_delivery` |
|---|---|---|---|---|
| 1581 | analyzed | real summary | true | `sent` |
| 1582 | analyzed | real summary | true | `sent` |

`sent` is Telegram's own `ok: true`, not an assumption. **This is only observable because
`tgSend` was fixed in the same pass**: it used to end in `.catch(() => {})`, so a revoked token, a
wrong chat id and a Telegram outage were all indistinguishable from success. That is the same
silent-failure class as the triage bug, and it is exactly what would have hidden a botched
rotation. A first read of report 1581 showed `telegram_notified: false` — the delivery update
simply had not landed yet. Re-read before concluding.

---

## 3 — THE SWEEP: EVERY OTHER SECRET

Method: shape-based scan of the **working tree**, then **every blob in git history** — 12,417
objects, every blob under 4 MB decoded and matched. Plus a structural JWT check that decodes each
payload and reads its `role`, because a Supabase key cannot be judged by its prefix.

### ⚠️ SUPABASE SERVICE-ROLE KEY: **NO. NOT ANYWHERE.**

Asked explicitly, answered explicitly. **Zero** service-role JWTs in the working tree or in any
blob in history, and **zero** `SERVICE_ROLE_KEY = <value>` assignments. Every JWT in the repository
decodes to one of exactly two things:

- `role: anon`, `iss: supabase` — **public by design**, it ships inside the app bundle. Present in
  `app.json`, `utils/supabase.ts`, the test harnesses and every built bundle. Not a leak.
- `role: authenticated` — one anonymous *user session* token in `tests/caps-onboarded.json`, a test
  fixture, expired 2026-09-01.

### Findings, ranked by blast radius

| # | What | Where | Live? | Exposure |
|---|---|---|---|---|
| 1 | **Supabase personal access token** (`sbp_`, 44 ch) | `.claude/settings.local.json`, 5 blob versions | **DEAD** — `api.supabase.com` returns 401 | PUBLIC, history only, not at HEAD |
| 2 | **Anthropic API key** (108 ch) | `web-dist/…index-b5f65129….js` and `web-dist-new/…index-87fabe1be….js`, in an `x-api-key` header | **DEAD** — 401 from `/v1/models` | PUBLIC, history only |
| 3 | **Telegram bot token** | the two paths above | REVOKED by Roye | PUBLIC, 81 days |
| 4 | **Google API key** (`AIza`, 39 ch) | `prompts/VAMOS-CAPS-CHECK-BUG-REPORT-2026-03-21-0943.md` | **DEAD** — `API_KEY_INVALID`, not merely a disabled API | PUBLIC, **was still at HEAD** |
| 5 | Twilio **Account SID** (`ACf826…`) | `docs/CAPS-MASTER-KNOWLEDGE-v2.md` + 6 prompt files | n/a | identifier, not a credential; no auth token anywhere near it |
| 6 | Vercel project / team ids, GCP OAuth client id | `docs/CAPS-MASTER-KNOWLEDGE-v2.md` | n/a | identifiers, not credentials |
| 7 | `sk-ant-api03-your-key-here` | `.env.example` | n/a | placeholder, correctly so |

**Why #1 outranks #2 and #3.** A Supabase personal access token is worse than a service-role key,
because it can *mint* one: it manages the project — read and rotate every API key, deploy or
rewrite Edge Functions, run arbitrary SQL, drop the database. Every RLS policy this project spent
weeks building is downstream of it. It was dead when tested, which is luck, not process.

**#2 is the one that should change behaviour.** A real Anthropic key was compiled into two
**shipped web bundles** in an `x-api-key` header, meaning the app once called Anthropic directly
from the browser. Anyone who merely *loaded the site* had it, not only people who read the repo.
That is a design fault, not a slip: a provider key must never reach client code.

Liveness was tested **read-only** — a models list, a project list, a key-validity probe. Nothing was
revoked, disabled or rotated. **Nothing else was revoked. Roye orders.**

`graphify-out/` was checked specifically: it holds only code-graph metadata — file paths and
function names, no credentials. `PROJECT-INFO.json`: nothing credential-shaped. All GitHub workflow
files use `${{ secrets.* }}` with no inline values.

### One change made outside the Telegram purge

The dead Google key at HEAD was replaced with `$GOOGLE_DRIVE_API_KEY` and the file carries a note
saying it was dead when tested. Leaving a credential-shaped string at HEAD would have meant the new
guard failed on every commit from now on.

---

## 4 — THE STANDING GUARD

`scripts/scan-secrets.mjs`, wired in two places. It reports the **file and the kind, never the
value** — printing a secret into a CI log is the same mistake in a different file.

- **`.githooks/pre-commit`** — fast local refusal. Enable once per clone:
  `git config core.hooksPath .githooks`
- **`.github/workflows/secret-scan.yml`** — runs on every push and pull request. This is the half
  that cannot be skipped; `--no-verify` bypasses the hook, and a fresh clone has no hook at all.

It covers all four shapes found today plus OpenAI, GitHub, Stripe, Slack, AWS, SendGrid, private
key blocks and passworded connection strings, and it decodes JWTs to catch a service-role key that
no prefix would reveal.

**It was watched doing both jobs.** `--self-test` proves the patterns still fire (6 detected, and
the public anon key and the `.env.example` placeholder correctly ignored — a scanner that cries
wolf gets disabled). CI runs that self-test *before* the scan, so patterns that have silently
stopped matching cannot report "clean". And a real commit carrying a token-shaped string was
**refused** by the hook: `HEAD` did not move.

### Recommended, not done

`git ls-files` still tracks **251 files** under `dist/`, `web-*-dist/` and `graphify-out/`. Those
directories were added to `.gitignore` after the fact, which does not untrack what is already
tracked — and committed build output is exactly how the Anthropic key became public. `git rm
--cached -r` on those trees would close that route, but it is a 251-file diff and belongs in its
own change.

---

## WHAT WAS NOT DONE

- Nothing revoked, disabled or rotated beyond the token Roye had already revoked.
- Git history not rewritten.
- The bot's display name and description still carry the attacker's advert. Roye's call.
- `CAPS_BUG_BOT_TOKEN` still sits in the vault holding the dead token. Nothing reads it any more;
  it can be deleted whenever Roye wants.
- Economy, flags, winner cue, layout and navigation untouched.
