# DB objects — CAPS Poker (gxrpunvhjcrzqnitbqah), measured 2026-09-10

Every count below was read from the live catalog today (`pg_class`, `pg_proc`, `pg_policies`, `pg_trigger`, `cron.job`, `cron.job_run_details`), not from a doc. Re-run the queries in `QUERIES.md` before quoting any of these numbers later.

## Counts

| object | count | of which |
|---|---|---|
| tables (`relkind r`, schema public) | **73** | 11 have 0 rows · 3 are backups/archives (`_backup_starter_redemptions_20260816`, `chip_transactions_prereset_20260901`, `_econ_fn_backup`) · 1 temp (`_tmp_commit_blobs`) · 20 carry no timestamp column |
| functions (`pg_proc`) | **198** | 188 distinct names, 10 overloaded pairs (`add_xp`, `assign_daily_missions`, `claim_emergency_chips`, `earn_chips`, `get_daily_missions`, `get_home_screen_v3`, `get_leaderboard`, `on_app_open`, `record_hand_net`, `spend_chips`) · 185 SECURITY DEFINER · 154 executable by `anon` · all owned by `postgres` · 184 plpgsql, 14 sql |
| views | **12** | 2 `security_invoker` · 7 flagged SECURITY-DEFINER by the advisor, of which **7 are readable by anon** (measured with `SET ROLE anon`, see below) |
| triggers (non-internal) | **8** | all enabled (`O`) |
| RLS policies | **100** | across 58 tables; 15 tables have RLS on and 0 policies (deny-all for client roles) |
| cron jobs | **31** | all `active`; 0 failures in the last 7 days; 4 push jobs last failed 2026-04-12/13 (`up.is_bot does not exist`, `push_log.user_id null`) and have succeeded daily since |
| extensions | 7 | pg_cron 1.6.4 · pg_net 0.20.0 (in `public`, advisor WARN) · pg_stat_statements · pgcrypto · plpgsql · supabase_vault · uuid-ossp |
| migrations in the live ledger | ~330 | vs **43 files** in `supabase/migrations/` on main. The newest ledger entry `20260908213547 close_submit_score_chip_faucet` has NO file on main — its file exists only on branch `claude/vamos-caps-align-celebration-flppo0` (33 commits ahead of main). Five files on `feat/server-deal-phase-a` (`20260801090000…20260801093000`) are on no other branch and are not in the ledger by name. |
| edge functions deployed | **14** | 13 directories in the repo; `resolver-probe` exists only as a deployment; 8 of 14 were hand-deployed (`entrypoint_path` = `source/index.ts`) — see `EDGE-FUNCTIONS.md` |

## What the 198-functions / 73-tables ratio actually contains

With 25 devices that have ever played (by `leaderboard.games_played > 0`), the schema is not "a poker game"; it is a poker game plus five other systems that grew around it:

| family | tables | functions (approx, by name) | state |
|---|---|---|---|
| the game + economy (leaderboard, hand_history, chip_transactions, chip_config, device_identity, econ_*, game_rooms, room_players, game_hands, cups, achievements) | 16 | ~70 | LIVE — every hand touches them |
| retention / push / missions / streaks / referrals / levels (push_*, daily_*, user_missions, player_streaks, player_levels, referral_*, friend_challenges, ad_watches, funnel_snapshots) | 15 | ~45 | DORMANT — 8 push/recap crons run daily and address 3 push tokens, 0 challenges; `user_missions` last written 2026-08-22, missions retired |
| bug / crash / QA / debug pipeline (bug_*, crash_reports, error_logs, debug_sessions, qa_reports, whatsapp_*, telegram_sessions, learning_events, heatmap_events, caps_simulation_runs, card_readability_brief) | 16 | ~35 | MIXED — bug_reports and whatsapp_outbound live; 6 of these tables have 0 rows |
| ops / self-monitoring (audit_logs, prompt_execution_log, dual_write_retry_queue, deploy_*, build_history, app_config, session_handoffs, vamos_handoffs, test_devices) | 11 | ~30 | LIVE for the bot workflow, not for players |
| sit-and-go / clubs / quick-poker / shared hands (sit_and_go_*, clubs, club_*, quick_poker_sessions, shared_hands, sng_bot_names) | 8 | ~15 | DORMANT — last writes 2026-04 to 2026-06 |
| backups / temp (_backup_*, chip_transactions_prereset_*, _econ_fn_backup, _tmp_commit_blobs) + purchases/chip_purchases/starter_pack_redemptions | 7 | ~3 | INERT — 0 purchases ever; payments off |

Function callers were established by searching the repo for `.rpc('name')`, the name anywhere in client code, cron commands, trigger bindings, view definitions and other function bodies — see `DB-FUNCTIONS.md` for the per-function row. Result: **105 have a live caller** (trigger, cron, client rpc or edge function), **68 are referenced only by other SQL, a view or a code mention**, **25 have no caller found anywhere**. The 25 are flagged, not removed.

## Tables — rows, last write, RLS, policies, anon table grants

`anon grants` are the raw table privileges; with RLS on and 0 policies the grant is inert (deny-all). `SEL` without a permissive SELECT policy is likewise inert. The one row where the grant is real is the RLS-OFF archive.

| table | rows | last write | RLS | policies | anon grants | comment |
|---|---|---|---|---|---|---|
| _backup_starter_redemptions_20260816 | 649 | 2026-06-22 | on | 0 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| _econ_fn_backup | 10 | (no ts col) | on | 0 | none | y |
| _tmp_commit_blobs | 2 | (no ts col) | on | 1 | DEL/INS/REF/SEL/TRI/TRU/UPD | y |
| account_deletion_requests | 1 | (no ts col) | on | 2 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| achievement_definitions | 36 | (no ts col) | on | 1 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| achievements | 160 | 2026-09-07 | on | 2 | REF/SEL/TRI |  |
| ad_watches | 2 | (no ts col) | on | 1 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| analytics_events | 8640 | 2026-09-10 | on | 2 | REF/TRI | y |
| app_config | 110 | 2026-08-28 | on | 2 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| audit_logs | 338 | 2026-09-10 | on | 1 | none |  |
| bug_notifications | 68 | 2026-03-30 | on | 1 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| bug_reports | 252 | 2026-09-06 | on | 2 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| bug_status_log | 240 | 2026-04-04 | on | 1 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| build_history | 46 | 2026-05-08 | on | 1 | DEL/INS/REF/SEL/TRI/TRU/UPD | y |
| caps_simulation_runs | 36 | 2026-03-30 | on | 1 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| card_readability_brief | 1 | 2026-04-20 | on | 2 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| chip_config | 51 | (no ts col) | on | 1 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| chip_purchases | 0 | never | on | 1 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| chip_rescue_log | 0 | (no ts col) | on | 1 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| chip_transactions | 467 | 2026-09-09 | on | 2 | REF/TRI | y |
| chip_transactions_prereset_20260901 | 4237 | 2026-08-31 | **OFF** | 0 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| club_game_results | 0 | (no ts col) | on | 1 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| club_members | 2 | 2026-06-28 | on | 1 | none |  |
| clubs | 1 | 2026-06-28 | on | 1 | none |  |
| crash_reports | 350 | 2026-09-01 | on | 3 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| cups | 5 | (no ts col) | on | 1 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| daily_missions | 20 | (no ts col) | on | 1 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| daily_rewards | 416 | 2026-09-09 | on | 2 | REF/SEL/TRI |  |
| debug_sessions | 0 | never | on | 2 | REF/SEL/TRI |  |
| deploy_log | 139 | 2026-05-02 | on | 2 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| deploy_tracker | 3 | 2026-03-21 | on | 1 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| device_cups | 6 | 2026-06-24 | on | 2 | REF/SEL/TRI |  |
| device_identity | 14 | 2026-09-09 | on | 0 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| dual_write_retry_queue | 721 | 2026-09-10 | on | 2 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| econ_rate_counters | 996 | (no ts col) | on | 0 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| econ_score_gain_daily | 2 | (no ts col) | on | 0 | none |  |
| economy_log | 332 | 2026-04-16 | on | 2 | REF/SEL/TRI |  |
| error_logs | 0 | never | on | 1 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| friend_challenges | 0 | never | on | 1 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| funnel_snapshots | 1 | 2026-04-13 | on | 1 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| game_hands | 0 | never | on | 0 | none |  |
| game_rooms | 9 | 2026-09-08 | on | 1 | none | y |
| hand_history | 78 | 2026-09-07 | on | 1 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| heatmap_events | 569 | 2026-09-07 | on | 2 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| leaderboard | 403 | 2026-09-09 | on | 4 | DEL/INS/REF/TRI/TRU/UPD |  |
| learning_events | 0 | never | on | 1 | REF/SEL/TRI |  |
| player_cups | 0 | never | on | 1 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| player_levels | 1 | 2026-04-13 | on | 1 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| player_poker_stats | 2 | 2026-04-13 | on | 1 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| player_streaks | 1477 | 2026-09-09 | on | 1 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| prompt_execution_log | 734 | 2026-09-10 | on | 3 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| purchases | 0 | never | on | 0 | none |  |
| push_log | 1 | 2026-04-13 | on | 1 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| push_templates | 20 | 2026-03-30 | on | 1 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| push_tokens | 3 | 2026-04-07 | on | 5 | DEL/INS/REF/SEL/TRI/TRU/UPD | y |
| qa_reports | 0 | never | on | 2 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| quick_poker_sessions | 51 | 2026-04-19 | on | 1 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| referral_links | 1894 | 2026-09-09 | on | 1 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| referral_redemptions | 2 | 2026-09-03 | on | 0 | none |  |
| room_players | 0 | never | on | 1 | SEL | y |
| session_handoffs | 1 | 2026-05-03 | on | 1 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| shared_hands | 599 | 2026-08-23 | on | 2 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| sit_and_go_players | 36 | 2026-06-24 | on | 4 | none |  |
| sit_and_go_sessions | 6 | 2026-06-24 | on | 4 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| sng_bot_names | 150 | (no ts col) | on | 1 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| starter_pack_redemptions | 0 | never | on | 4 | REF/SEL/TRI |  |
| telegram_sessions | 0 | never | on | 1 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| test_devices | 19 | (no ts col) | on | 0 | none | y |
| user_missions | 3498 | 2026-08-22 | on | 1 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| user_profiles | 2206 | 2026-09-09 | on | 3 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |
| vamos_handoffs | 207 | 2026-09-09 | on | 0 | DEL/INS/REF/SEL/TRI/TRU/UPD | y |
| whatsapp_outbound | 56 | 2026-09-10 | on | 1 | DEL/INS/REF/SEL/TRI/TRU/UPD | y |
| whatsapp_sessions | 226 | 2026-09-06 | on | 1 | DEL/INS/REF/SEL/TRI/TRU/UPD |  |

Liveness by last write: **13 tables written this week**, **9 in the last month**, **20 not since June or earlier**, **11 never**, 20 have no timestamp column to measure by.

## Views — and what anon can actually read (measured with `SET ROLE anon`)

| view | security_invoker | anon SELECT | anon-readable rows today | reads |
|---|---|---|---|---|
| `friction_heatmap` | no | **yes** | 5 | analytics_events (service-role-only table) |
| `top_abandon_screens` | no | **yes** | 1 | analytics_events |
| `top_rage_tap_targets` | no | **yes** | 5 | analytics_events |
| `top_stuck_screens` | no | **yes** | 3 | analytics_events |
| `v_grant_without_session` | no | **yes** | 7 rows: **device_id + total_chips** | leaderboard (device_id was revoked from anon on 2026-08-15) + analytics_events |
| `v_harness_devices_v2` | no | **yes** | 8 rows: **device_id** | `v_harness_devices` (which anon is DENIED) ∪ `v_simulator_devices` |
| `v_simulator_devices` | no | **yes** | 2 rows: device_id | analytics_events |
| `v_harness_devices` | no | no — `permission denied for view` | — | leaderboard, analytics_events, chip_transactions, hand_history, device_identity, player_streaks … |
| `v_analytics_human` | no | no grant | — | analytics_events |
| `v_automation_devices` | no | no grant | — | analytics_events |
| `v_feedback_summary` | **yes** | no grant | — | bug_reports |
| `v_recent_feedback` | **yes** | no grant | — | bug_reports |

The same measurement against the archive table: `SET ROLE anon; SELECT count(*) FROM chip_transactions_prereset_20260901` → **4,237** (RLS off, full grants). The live `chip_transactions` is service-role-only; its pre-reset copy is not.

## Triggers

| trigger | table | function | when |
|---|---|---|---|
| bug_reports_rate_limit | bug_reports | enforce_bug_report_rate_limit | BEFORE INSERT |
| on_bug_report_inserted | bug_reports | trigger_analyze_bug_report | AFTER INSERT |
| game_rooms_lock_host_id_trg | game_rooms | game_rooms_lock_host_id | BEFORE UPDATE |
| trg_hand_history_achievements | hand_history | tg_hand_history_check_achievements | AFTER INSERT |
| trg_hand_history_leaderboard | hand_history | tg_hand_history_leaderboard_counters | AFTER INSERT |
| trg_ledger_starting_grant | leaderboard | ledger_starting_grant | AFTER INSERT |
| user_profiles_lock_privileged_columns_trg | user_profiles | user_profiles_lock_privileged_columns | BEFORE UPDATE |
| trg_auto_dismiss_dirty | whatsapp_sessions | auto_dismiss_dirty_shutdown | BEFORE INSERT |

## Cron jobs — 7-day health (ok/runs) and last success

| id | job | schedule | does | ok/runs 7d | last ok |
|---|---|---|---|---|---|
| 2 | flush-whatsapp-outbound | `*/2 * * * *` | net.http_post → edge fn flush-outbound | 5040/5040 | 2026-09-10 10:22 |
| 4 | cleanup-debug-sessions | `0 4 * * *` | DELETE debug_sessions older than 7d (table has 0 rows) | 7/7 | 2026-09-10 07:00 |
| 5 | cleanup-old-whatsapp | `30 4 * * *` | DELETE sent/failed whatsapp_outbound older than 30d | 7/7 | 2026-09-10 07:30 |
| 6 | caps_daily_bonus_push | `0 7 * * *` | send_daily_bonus_push() | 7/7 | 2026-09-10 10:00 |
| 7 | caps_streak_risk_push | `0 17 * * *` | send_streak_risk_push() | 7/7 | 2026-09-09 20:00 |
| 8 | caps_winback_push | `0 8 * * *` | send_winback_pushes() | 7/7 | 2026-09-09 11:00 |
| 9 | caps_flash_deal_push | `0 9 * * *` | send_flash_deal_push() | 7/7 | 2026-09-09 12:00 |
| 10 | caps_weekly_recap | `0 10 * * 0` | send_weekly_recaps() | 1/1 | 2026-09-06 13:00 |
| 11 | caps_expire_challenges | `0 * * * *` | expire pending friend_challenges (table has 0 rows) | 168/168 | 2026-09-10 10:00 |
| 14 | caps_retention_push | `0 7 * * *` | send_retention_pushes() | 7/7 | 2026-09-10 10:00 |
| 17 | caps_daily_digest | `0 21 * * *` | run_daily_digest() | 7/7 | 2026-09-10 00:00 |
| 18 | auto_dismiss_stale_crashes_daily | `30 3 * * *` | auto_dismiss_stale_crashes(3) | 7/7 | 2026-09-10 06:30 |
| 19 | weekly-caps-smoke-test | `0 5 * * 0` | smoke_test_caps() | 1/1 | 2026-09-06 08:00 |
| 20 | caps_push_coverage_alert | `0 6 * * *` | daily_push_coverage_alert() | 7/7 | 2026-09-10 09:00 |
| 21 | daily_drift_scan_logged | `10 6 * * *` | scan_all_drift_logged('caps-poker') | 7/7 | 2026-09-10 09:10 |
| 22 | daily_reconciliation | `10 7 * * *` | run_daily_reconciliation — posts a prompt_execution_log COUNT to Empire HQ; reconciles nothing about chips | 7/7 | 2026-09-10 10:10 |
| 23 | dual_write_retry_worker | `*/10 * * * *` | process_dual_write_retry_queue() | 1008/1008 | 2026-09-10 10:20 |
| 25 | process_account_deletions_daily | `0 3 * * *` | process_pending_deletions() | 7/7 | 2026-09-10 06:00 |
| 26 | caps_e2e_anonymous_test_daily | `0 0 * * *` | run_e2e_test_with_alert() | 7/7 | 2026-09-10 03:00 |
| 27 | caps_uuid_drift_weekly | `0 3 * * 1` | run_uuid_drift_scan_with_alert() | 1/1 | 2026-09-07 06:00 |
| 28 | caps_release_pulse_morning | `0 6 * * *` | run_release_pulse_with_alert() | 7/7 | 2026-09-10 09:00 |
| 29 | heartbeat_self_report | `*/20 * * * *` | self_report_heartbeat() | 504/504 | 2026-09-10 10:20 |
| 30 | caps_daily_backup | `25 0 * * *` | caps_backups.snapshot_critical_tables() | 7/7 | 2026-09-10 03:25 |
| 31 | caps_weekly_backup_purge | `35 1 * * 0` | caps_backups.purge_old_snapshots(14) | 1/1 | 2026-09-06 04:35 |
| 32 | caps_cleanup_expired_rooms | `*/2 * * * *` | cleanup_expired_rooms() | 5040/5040 | 2026-09-10 10:22 |
| 33 | lobby_v2_ensure_public_pool | `*/2 * * * *` | ensure_public_lobby() | 5040/5040 | 2026-09-10 10:22 |
| 34 | caps_evict_ghost_seats | `* * * * *` | evict_ghost_seats(90) (room_players has 0 rows) | 10080/10080 | 2026-09-10 10:23 |
| 35 | caps_finish_wedged_playing | `* * * * *` | finish_wedged_playing_rooms(120) (0 rooms have ever been playing) | 10080/10080 | 2026-09-10 10:23 |
| 36 | caps_phase0_tripwire | `7 * * * *` | phase0_mp_traffic_tripwire() | 168/168 | 2026-09-10 10:07 |
| 37 | caps_security_posture | `23 * * * *` | security_posture_tripwire() | 168/168 | 2026-09-10 10:23 |
| 38 | caps_phase0_flag_coupling | `41 * * * *` | phase0_flag_coupling_tripwire() | 168/168 | 2026-09-10 09:41 |

Nothing here computes the float-vs-ledger gap. `health_check()` sums `leaderboard.total_chips` and counts `chip_transactions` rows but never compares the two; `run_daily_reconciliation` reconciles prompt-log counts with Empire HQ. "Ledger gap 0" is measured by hand every sprint and by no control.
