# Edge functions — 14 deployed, 13 in the repo, measured 2026-09-10

Deployment metadata from the Supabase API (`list_edge_functions`). `style` is read from `entrypoint_path`: a repo deploy carries `source/supabase/functions/<slug>/index.ts`; a hand deploy carries a bare `source/index.ts`, meaning someone ran `supabase functions deploy` from a directory that was not the repo — the working tree at that moment, not a commit, is what runs.

| slug | version | last deployed (UTC) | verify_jwt | style | in repo | deployed vs repo |
|---|---|---|---|---|---|---|
| `sync-bugs-to-drive` | v22 | 2026-05-17 | on | repo | yes | *(see diff table below)* |
| `log-error` | v20 | 2026-04-19 | off | hand | yes | *(see diff table below)* |
| `whatsapp-bot-handler` | v70 | 2026-07-15 | on | repo | yes | *(see diff table below)* |
| `analyze-bug-report` | v22 | 2026-09-06 | on | hand | yes | *(see diff table below)* |
| `crash-analyzer` | v17 | 2026-07-15 | on | repo | yes | *(see diff table below)* |
| `auto-fix-crashes` | v19 | 2026-05-17 | on | repo | yes | *(see diff table below)* |
| `flush-outbound` | v14 | 2026-07-15 | off | repo | yes | *(see diff table below)* |
| `telegram-bot-handler` | v29 | 2026-09-06 | off | hand | yes | *(see diff table below)* |
| `retriage-pending` | v11 | 2026-09-06 | off | hand | yes | *(see diff table below)* |
| `legal` | v9 | 2026-05-02 | off | hand | yes | *(see diff table below)* |
| `anthropic-proxy` | v9 | 2026-05-18 | on | hand | yes | *(see diff table below)* |
| `resolver-probe` | v4 | 2026-08-17 | off | hand | **NO — deploy-only** | *(see diff table below)* |
| `resolve-hand` | v11 | 2026-08-23 | off | repo | yes | *(see diff table below)* |
| `verify-purchase` | v4 | 2026-08-22 | on | hand | yes | *(see diff table below)* |

Callers worth knowing: `flush-outbound` — cron job 2 every 2 min (net.http_post); `resolve-hand` — the multiplayer settlement writer (service role); 0 rooms have ever reached playing, so it has never settled a real hand; `analyze-bug-report` — trigger on_bug_report_inserted → trigger_analyze_bug_report; `legal` — app_config privacy_policy_url / terms_url / legal_index_url point here.

Three functions were re-deployed on 2026-09-05 (`analyze-bug-report`, `telegram-bot-handler`, `retriage-pending`) by hand, the same day as the ledger's `rotate_telegram_bot_token_20260906` / `preinvite_trigger_auth_and_triage_failed_bucket` migrations, neither of which has a file on main.

## Deployed source vs repo source

Every deployed function was pulled with `get_edge_function`, saved, and diffed against `supabase/functions/<slug>/` (`diff --strip-trailing-cr`); the orchestrator re-ran the transport greps and the byte comparisons on the saved copies.

| slug | verdict | lines differing | what differs |
|---|---|---|---|
| `whatsapp-bot-handler` | **DIFFERS — deployment ahead of repo** | 82 (3,920 raw: the deployment is CRLF) | Deployed v70 (2026-07-15) sends outbound WhatsApp through Empire HQ `empire-messaging` (`EMPIRE_MESSAGING_URL`/`_SECRET`, 9 references, 12 s timeout, `media_url`); the repo copy (last commit `33af3ac`, 2026-05-17) POSTs straight to `api.twilio.com` with Basic auth and `!`-asserts `TWILIO_WHATSAPP_FROM` at module load. The repo's diagnostic branch (`index.ts:1101-1105`) sends a real "Direct test" WhatsApp to a hardcoded personal number; the deployment runs a recipient-less dry probe instead. **A deploy from the repo reverts the egress route and refuses every send if that Twilio secret is absent.** Same shape as the ftable `seo-prerender` near-miss. |
| `crash-analyzer` | **DIFFERS — deployment ahead of repo** | 47 | Same transport swap (7 `EMPIRE_MESSAGING` references deployed, 0 in the repo); the repo copy reads `TWILIO_ACCOUNT_SID/AUTH_TOKEN/WHATSAPP_FROM` with no timeout and no response check. Deployment v17 (2026-07-15) has a repo-shape entrypoint and was never committed. |
| `analyze-bug-report` | code-equivalent | 55 (comments + one `⚠️` literal vs escape) | Deploy v22 at 2026-09-06 03:14 precedes commit `41b534d` at 03:22 — the repo is the post-deploy polish, not a fork. A repo comment says "Deno.env is preferred … otherwise the vault"; the code in both copies is vault-first. |
| `retriage-pending` | code-equivalent | 43 (comments only) | same 2026-09-06 sequence; same stale comment |
| `telegram-bot-handler` | code-identical | 6 (`-` vs `—` in comments) | repo also holds a 0-byte `handler.ts` the deployment does not have |
| `resolve-hand` | IDENTICAL | 0 | the settlement writer. The deployed bundle carries generated `_shared/{handEvaluator,cards,chipMath}.ts` (gitignored by design); they match `constants/cards.ts`, `utils/chipMath.ts` exactly and `utils/handEvaluator.ts` up to the generator's import rewrite |
| `verify-purchase` | IDENTICAL | 0 (both files) | |
| `anthropic-proxy` | IDENTICAL | 0 | default model `claude-haiku-4-5-20251001` |
| `legal` | IDENTICAL | 0 | unchanged since 2026-05-02 |
| `auto-fix-crashes` | IDENTICAL | 0 | model `claude-sonnet-4-20250514`; requires `Bearer` (see FINDINGS #21) |
| `flush-outbound` | IDENTICAL | 0 | hardcoded Empire HQ project URL as the default at :11 in both copies |
| `log-error` | IDENTICAL | 0 | |
| `sync-bugs-to-drive` | IDENTICAL | 0 | only `console.log`s its body (see FINDINGS minor) |
| `resolver-probe` | **DEPLOY-ONLY** | n/a | v4, 2026-08-17: a Deno handler returning `{ok, ranks:13, suits:4, viaChain}` by importing `./_shared/cards.ts` and `./_shared/probe.ts` — attempt 3 of a bundler/resolver experiment behind `gen-edge-shared.mjs`; ships an empty `deno.json`. Reads no env, no DB, no network; writes nothing; `verify_jwt` off. Inert, undocumented, undeletable from the repo because it has no file. |

Secret-looking literals: no credential-shaped literal (API key, bot token, Twilio SID/token) in any deployed or repo copy. A personal WhatsApp number is hardcoded as the `ROYE_WHATSAPP_NUMBER` fallback in both copies of `whatsapp-bot-handler` (deployed :1141/:1216/:1486, repo :1127/:1202/:1472) and as the `To:` of the repo-only "Direct test" send (:1104). Empire HQ's project ref appears as a URL default in `crash-analyzer`, `flush-outbound` and `whatsapp-bot-handler` — a project ref, not a secret.

**Rule for the two drifted functions:** do not `supabase functions deploy` either from the repo until the deployed source is committed. `git show` cannot recover it; `get_edge_function` can, and the saved copies from this audit are byte-exact.

