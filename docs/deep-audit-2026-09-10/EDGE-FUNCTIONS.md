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

DIFF-TABLE-PLACEHOLDER
