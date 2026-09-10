# DB function inventory — 198 functions, measured 2026-09-10 from pg_proc on gxrpunvhjcrzqnitbqah

Columns: signature · SECURITY DEFINER · anon EXECUTE · callers found (trigger / cron / client `.rpc()` / client mention / edge function / other SQL functions / views) · repo migrations naming it.
`no caller found` means none of those seven searches hit; it is a flag for review, not proof of death — search before removing anything.

| function | secdef | anon | callers | migs |
|---|---|---|---|---|
| `accept_friend_challenge(p_user_id uuid, p_code text)` | D | A | client-mention | 0 |
| `add_xp(p_device_id text, p_xp integer, p_source text)` | D | A | client-mention, sql-fns(3) | 1 |
| `add_xp(p_user_id uuid, p_xp integer, p_source text)` | D |  | client-mention, sql-fns(3) | 1 |
| `assign_daily_missions(p_user_id uuid)` | D | A | client-mention, sql-fns(1) | 0 |
| `assign_daily_missions(p_device_id text)` | D | A | client-mention, sql-fns(1) | 0 |
| `assign_daily_missions_d(p_device_id text)` | D | A | sql-fns(1) | 0 |
| `auto_dismiss_dirty_shutdown()` | D |  | trigger | 0 |
| `auto_dismiss_stale_crashes(p_supersede_threshold integer)` | D |  | cron | 1 |
| `cancel_account_deletion(p_user_id uuid, p_cancellation_reason text)` | D | A | sql-fns(2) | 0 |
| `caps_release_pulse()` | D |  | sql-fns(1) | 0 |
| `caps_testflight_audit()` | D |  | **no caller found** | 0 |
| `check_achievements(p_user_id uuid, p_device_id text)` | D | A | client-mention, edge-fn, sql-fns(2) | 0 |
| `check_achievements_resolve_uid(p_device_id text)` | D | A | sql-fns(1) | 0 |
| `check_cups(p_device_id text)` | D | A | client-rpc, sql-fns(1) | 1 |
| `check_d3_retention(p_user_id uuid)` | D | A | sql-fns(3) | 0 |
| `check_winback(p_user_id uuid)` | D | A | sql-fns(3) | 0 |
| `claim_daily_reward(p_device_id text)` | D | A | client-mention | 2 |
| `claim_daily_streak(p_device_id text)` | D | A | client-mention, sql-fns(1) | 4 |
| `claim_emergency_chips(p_user_id uuid)` | D | A | client-mention, sql-fns(3) | 2 |
| `claim_emergency_chips(p_device_id text)` | D | A | client-mention, sql-fns(3) | 2 |
| `claim_low_chip_rescue(p_device_id text)` | D | A | client-mention, sql-fns(1) | 3 |
| `claim_mission(p_user_id uuid, p_mission_id text)` | D | A | **no caller found** | 0 |
| `claim_mission_d(p_device_id text, p_mission_id text)` | D | A | client-rpc | 0 |
| `claim_share_reward(p_device_id text, p_share_id text)` | D | A | client-mention | 1 |
| `claim_winback_rescue(p_device_id text)` | D | A | client-mention | 2 |
| `cleanup_expired_rooms()` |  |  | cron, client-rpc | 2 |
| `club_leaderboard(p_club_code text)` | D | A | client-rpc | 0 |
| `create_club(p_name text, p_device_id text, p_user_id uuid, p_display_nam)` | D | A | client-rpc | 0 |
| `create_club_table(p_club_code text, p_player_count integer, p_device_id text, )` | D | A | client-rpc | 0 |
| `create_friend_challenge(p_user_id uuid, p_mode text, p_buyin integer)` | D | A | client-rpc | 0 |
| `create_referral_code(p_device_id text)` | D | A | client-rpc, sql-fns(1) | 0 |
| `create_referral_link(p_device_id text)` | D | A | client-rpc, sql-fns(1) | 0 |
| `create_table(p_player_count integer, p_host_id uuid, p_host_name text, p_)` | D | A | client-rpc | 2 |
| `credit_purchase(p_device_id text, p_package_id text, p_provider text, p_rece)` | D |  | client-rpc, edge-fn, sql-fns(1) | 4 |
| `daily_push_coverage_alert()` | D |  | cron | 0 |
| `dashboard()` | D | A | client-mention, edge-fn, sql-fns(1) | 5 |
| `deal_hand(p_room_code text, p_device_id text, p_hand_no integer, p_ful)` | D | A | client-rpc | 0 |
| `delete_user_account(p_device_id text, p_user_id uuid)` | D |  | client-rpc, sql-fns(1) | 0 |
| `earn_chips(p_device_id text, p_event_type text, p_amount integer)` | D | A | client-rpc, edge-fn, sql-fns(10) | 6 |
| `earn_chips(p_user_id uuid, p_event_type text, p_amount integer)` | D |  | client-rpc, edge-fn, sql-fns(10) | 6 |
| `econ_authz_probe(p_fn text, p_device text, p_claimed_uid uuid)` | D | A | client-mention, sql-fns(16) | 7 |
| `econ_bind_ok(p_device_id text)` | D | A | client-rpc, sql-fns(15) | 7 |
| `econ_rate_ok(p_device_id text)` | D | A | client-rpc, sql-fns(14) | 5 |
| `enforce_bug_report_rate_limit()` | D | A | trigger | 0 |
| `ensure_leaderboard_row(p_device_id text)` | D |  | client-mention, sql-fns(3) | 3 |
| `ensure_public_lobby()` | D | A | cron, client-rpc, sql-fns(1) | 3 |
| `escalate_no_changes(p_session_id uuid, p_reason text)` | D |  | edge-fn | 0 |
| `evict_ghost_seats(p_stale_seconds integer)` | D |  | cron, client-rpc | 2 |
| `feedback_quick_stats()` | D | A | **no caller found** | 0 |
| `finish_table(p_room_code text, p_device_id text, p_player_id uuid)` | D | A | client-rpc | 4 |
| `finish_wedged_playing_rooms(p_stale_seconds integer)` | D |  | cron, client-rpc | 2 |
| `game_rooms_lock_host_id()` |  | A | trigger | 0 |
| `generate_weekly_recap(p_user_id uuid)` | D |  | client-rpc, sql-fns(3) | 0 |
| `generate_weekly_recap_d(p_device_id text)` | D |  | sql-fns(1) | 0 |
| `get_achievements_list(p_user_id uuid)` | D | A | client-rpc, sql-fns(1) | 0 |
| `get_achievements_list_d(p_device_id text)` | D | A | client-rpc, sql-fns(1) | 0 |
| `get_analytics_dashboard(p_days integer)` | D | A | client-mention | 0 |
| `get_bot_difficulty(p_device_id text)` | D | A | client-rpc | 0 |
| `get_bug_tracker()` | D | A | client-rpc | 0 |
| `get_bug_triage()` | D | A | client-mention | 0 |
| `get_build_changelog(p_limit integer)` | D | A | **no caller found** | 1 |
| `get_caps_bug_telegram_config()` | D |  | edge-fn | 0 |
| `get_caps_dashboard()` | D | A | client-rpc | 0 |
| `get_caps_launch_dashboard()` | D | A | client-mention | 1 |
| `get_chip_store()` | D | A | sql-fns(2) | 0 |
| `get_cup_collection(p_device_id text)` | D | A | client-rpc, sql-fns(7) | 0 |
| `get_cup_collection_by_user(p_user_id uuid)` | D | A | sql-fns(3) | 0 |
| `get_current_build()` | D | A | client-mention, sql-fns(2) | 1 |
| `get_daily_digest()` | D | A | client-mention | 2 |
| `get_daily_missions(p_user_id uuid)` | D | A | client-mention, sql-fns(4) | 0 |
| `get_daily_missions(p_device_id text)` | D | A | client-mention, sql-fns(4) | 0 |
| `get_daily_missions_d(p_device_id text)` | D | A | client-mention, sql-fns(2) | 0 |
| `get_daily_report()` | D | A | **no caller found** | 0 |
| `get_daily_status(p_device_id text)` | D | A | client-mention, sql-fns(2) | 0 |
| `get_deletion_status(p_user_id uuid)` | D | A | sql-fns(1) | 0 |
| `get_elo_leaderboard(p_limit integer)` | D | A | client-rpc | 2 |
| `get_funnel_dashboard(p_days integer)` | D | A | client-mention | 0 |
| `get_game_config()` | D | A | **no caller found** | 0 |
| `get_hand_history(p_user_id uuid, p_limit integer, p_offset integer, p_session)` | D | A | client-mention | 0 |
| `get_hand_replay(p_hand_id uuid)` | D | A | client-mention | 0 |
| `get_home_screen(p_device_id text)` | D | A | sql-fns(1) | 0 |
| `get_home_screen_v2(p_user_id uuid)` | D | A | client-mention | 0 |
| `get_home_screen_v3(p_user_id uuid)` | D | A | client-rpc, sql-fns(1) | 0 |
| `get_home_screen_v3(p_device_id text)` | D | A | client-rpc | 0 |
| `get_leaderboard(p_device_id text, p_limit integer)` | D | A | client-rpc | 2 |
| `get_leaderboard(p_limit integer)` | D | A | client-rpc | 2 |
| `get_level_config()` | D | A | **no caller found** | 0 |
| `get_live_build()` | D | A | client-mention, sql-fns(5) | 3 |
| `get_live_dashboard()` | D | A | client-mention | 1 |
| `get_next_build_number(p_version text)` | D | A | **no caller found** | 0 |
| `get_pending_whatsapp_messages()` | D | A | client-rpc | 0 |
| `get_pipeline_monitor()` | D | A | **no caller found** | 0 |
| `get_pipeline_status()` | D | A | **no caller found** | 0 |
| `get_play_of_the_day()` | D | A | client-rpc | 0 |
| `get_play_of_the_day_v2()` | D | A | client-mention | 0 |
| `get_player_hud(p_user_id uuid)` | D | A | **no caller found** | 0 |
| `get_player_level(p_user_id uuid)` | D | A | sql-fns(2) | 0 |
| `get_player_rank(p_user_id uuid)` | D | A | **no caller found** | 0 |
| `get_player_rank_by_device(p_device_id text)` | D | A | client-rpc | 0 |
| `get_player_stats(p_device_id text)` | D | A | client-rpc, sql-fns(1) | 0 |
| `get_player_stats_v2(p_player_id uuid)` | D | A | client-mention | 0 |
| `get_poker_shop(p_device_id text)` | D | A | client-mention | 0 |
| `get_push_dashboard()` | D | A | client-mention | 0 |
| `get_retention_analytics(p_days integer)` | D | A | client-mention | 0 |
| `get_session_stats_7d()` | D | A | edge-fn | 1 |
| `get_sng_activity_feed(p_device_id text, p_limit integer)` | D | A | client-rpc | 0 |
| `get_sng_status(p_session_id uuid)` | D | A | **no caller found** | 0 |
| `get_sng_tiers(p_user_id uuid)` | D | A | client-mention, sql-fns(1) | 0 |
| `get_stage_funnel()` | D | A | sql-fns(4) | 1 |
| `get_starter_offer_for_device(p_device_id text)` | D | A | client-rpc, sql-fns(2) | 0 |
| `handle_whatsapp_reply(p_from_number text, p_reply text)` | D | A | edge-fn | 0 |
| `health_check()` | D | A | client-mention, sql-fns(2) | 0 |
| `is_room_member(p_topic text)` | D | A | **no caller found** | 1 |
| `join_club(p_club_code text, p_device_id text, p_user_id uuid, p_displa)` | D | A | client-rpc, sql-fns(1) | 0 |
| `join_sit_n_go(p_device_id text, p_player_name text)` | D | A | client-rpc | 0 |
| `join_sit_n_go_solo(p_device_id text, p_player_name text)` | D | A | **no caller found** | 0 |
| `join_table(p_room_code text, p_player_id uuid, p_display_name text, p_d)` | D | A | client-rpc, sql-fns(2) | 5 |
| `leave_table(p_room_code text, p_player_id uuid, p_device_id text)` | D | A | client-rpc | 6 |
| `ledger_starting_grant()` | D | A | trigger | 3 |
| `list_club_tables(p_club_code text, p_device_id text, p_user_id uuid)` | D | A | client-rpc | 0 |
| `list_open_tables()` | D | A | client-rpc | 4 |
| `list_public_tables()` | D | A | client-rpc | 3 |
| `log_prompt_invocation(p_prompt_id text, p_project_slug text, p_outcome text, p_rat)` |  | A | client-mention, sql-fns(2) | 1 |
| `mark_whatsapp_sent(p_message_id uuid)` | D |  | **no caller found** | 0 |
| `merge_guest_to_user(p_device_id text, p_user_id uuid)` | D |  | client-rpc, sql-fns(1) | 0 |
| `my_clubs(p_device_id text, p_user_id uuid)` | D | A | client-rpc | 0 |
| `notify_bug_fix_result(p_session_id uuid, p_status text, p_message text)` | D |  | **no caller found** | 0 |
| `on_app_open(p_device_id text)` | D | A | client-mention, sql-fns(1) | 0 |
| `on_app_open(p_user_id uuid)` | D | A | client-mention, sql-fns(1) | 0 |
| `phase0_flag_coupling_tripwire()` | D | A | cron | 0 |
| `phase0_mp_traffic_tripwire()` | D | A | cron, client-mention | 0 |
| `process_dual_write_retry_queue()` |  | A | cron | 0 |
| `process_pending_deletions()` | D |  | cron | 0 |
| `purchase_item(p_device_id text, p_item_type text)` | D | A | client-rpc | 0 |
| `purge_user_data(p_user_id uuid)` | D |  | sql-fns(2) | 0 |
| `push_token_health()` | D | A | sql-fns(2) | 0 |
| `record_chip_purchase(p_user_id uuid, p_package_id text, p_receipt_id text)` | D |  | client-rpc | 0 |
| `record_club_game(p_club_code text, p_room_code text, p_results jsonb)` | D | A | client-rpc | 0 |
| `record_club_result(p_club_code text, p_device_id text, p_user_id uuid, p_won bo)` | D | A | client-rpc | 0 |
| `record_funnel_step(p_user_id uuid, p_step text, p_meta jsonb)` | D | A | sql-fns(2) | 0 |
| `record_hand_net(p_device_id text, p_net integer, p_hand_id text, p_is_practi)` | D | A | client-rpc, edge-fn, sql-fns(1) | 5 |
| `record_hand_net(p_device_id text, p_net integer, p_hand_id text)` | D | A | client-rpc, edge-fn, sql-fns(1) | 5 |
| `record_hand_result_d(p_device_id text, p_won boolean, p_boards_won integer, p_boa)` | D | A | client-rpc, sql-fns(1) | 2 |
| `record_reward(p_device_id text, p_amount integer, p_event_type text, p_onc)` | D | A | client-rpc, sql-fns(2) | 2 |
| `redeem_referral(p_device_id text, p_code text)` | D | A | client-rpc | 1 |
| `redeem_starter_offer(p_device_id text, p_user_id uuid, p_receipt_id text, p_platf)` | D | A | client-rpc, sql-fns(1) | 0 |
| `register_build(p_build_number integer, p_version text, p_commits jsonb, p_f)` | D |  | **no caller found** | 1 |
| `register_push_token(p_device_id text, p_token text, p_platform text)` | D | A | client-rpc | 0 |
| `request_account_deletion(p_user_id uuid, p_reason text, p_requested_via text)` | D | A | sql-fns(1) | 0 |
| `run_daily_digest()` | D |  | cron | 1 |
| `run_daily_reconciliation(p_project_slug text)` |  | A | cron | 0 |
| `run_e2e_test_with_alert()` | D |  | cron | 0 |
| `run_release_pulse_with_alert()` | D |  | cron | 0 |
| `run_uuid_drift_scan_with_alert()` | D |  | cron | 0 |
| `scan_all_drift()` |  | A | cron, sql-fns(2) | 0 |
| `scan_all_drift_logged(p_project_slug text)` |  | A | cron, sql-fns(1) | 0 |
| `scan_dead_rls_policies()` |  | A | sql-fns(2) | 0 |
| `scan_function_column_drift()` |  | A | sql-fns(2) | 0 |
| `scan_orphan_rpc_callers()` |  | A | sql-fns(2) | 0 |
| `scan_stale_crons()` |  | A | sql-fns(1) | 0 |
| `scan_uuid_only_rpcs_missing_d_variant()` | D |  | sql-fns(2) | 0 |
| `security_posture_tripwire()` | D | A | cron | 0 |
| `self_describe()` | D | A | client-mention | 0 |
| `self_report_heartbeat()` |  | A | cron | 0 |
| `send_daily_bonus_push()` | D |  | cron | 0 |
| `send_flash_deal_push()` | D |  | cron | 0 |
| `send_push_notification(p_user_id uuid, p_template_id text, p_vars jsonb)` | D |  | sql-fns(9) | 0 |
| `send_retention_pushes()` | D |  | cron | 0 |
| `send_streak_risk_push()` | D |  | cron | 0 |
| `send_weekly_recaps()` | D |  | cron | 0 |
| `send_winback_pushes()` | D |  | cron | 0 |
| `share_hand_card(p_hand_id uuid, p_user_id uuid)` | D | A | client-mention | 0 |
| `smoke_test_caps()` | D |  | cron, sql-fns(5) | 1 |
| `sng_eliminate(p_device_id text, p_session_id uuid)` | D |  | client-rpc | 0 |
| `spend_chips(p_device_id text, p_event_type text, p_amount integer)` | D | A | client-rpc, sql-fns(4) | 2 |
| `spend_chips(p_user_id uuid, p_event_type text, p_amount integer)` | D |  | client-rpc, sql-fns(5) | 2 |
| `start_quick_poker(p_user_id uuid)` | D | A | **no caller found** | 0 |
| `starter_pack_funnel_stats()` | D | A | **no caller found** | 0 |
| `submit_feedback(p_user_id uuid, p_message text, p_rating smallint, p_categor)` | D | A | sql-fns(1) | 0 |
| `submit_placements(p_room_code text, p_hand_no integer, p_device_id text, p_ass)` | D | A | client-rpc | 0 |
| `submit_score(p_device_id text, p_player_name text, p_total_chips bigint, )` | D | A | client-rpc | 3 |
| `summarize_daily_analytics()` | D |  | **no caller found** | 0 |
| `test_e2e_anonymous_flow()` | D |  | sql-fns(2) | 0 |
| `tg_hand_history_check_achievements()` | D | A | trigger | 0 |
| `tg_hand_history_leaderboard_counters()` | D | A | trigger | 1 |
| `touch_room_player(p_room_code text, p_device_id text, p_user_id uuid)` | D | A | client-rpc | 1 |
| `track_event(p_event text, p_user_id uuid, p_device_id text, p_data jsonb)` | D | A | client-rpc | 2 |
| `track_push_open(p_user_id uuid, p_template_type text)` | D | A | client-rpc, sql-fns(1) | 0 |
| `track_screen_size(p_device_id text, p_width integer, p_height integer)` | D | A | **no caller found** | 0 |
| `track_starter_offer_event(p_device_id text, p_event text)` | D | A | client-rpc | 0 |
| `trigger_analyze_bug_report()` | D |  | trigger, client-mention | 0 |
| `update_bug_status(p_bug_id uuid, p_new_status text, p_source text, p_note text)` | D |  | **no caller found** | 0 |
| `update_build_status(p_build_number integer, p_status text, p_notes text)` | D |  | **no caller found** | 0 |
| `update_elo(p_winner_id uuid, p_loser_id uuid, p_k_factor integer)` | D | A | **no caller found** | 0 |
| `update_leaderboard_elo(p_device_id text, p_won boolean)` | D | A | client-mention, sql-fns(1) | 0 |
| `update_mission_progress(p_device_id text, p_type text, p_amount integer)` | D | A | client-mention, sql-fns(1) | 0 |
| `user_profiles_lock_privileged_columns()` |  | A | trigger | 0 |
| `watch_rewarded_ad(p_user_id uuid)` | D | A | client-rpc | 0 |

LIVE (trigger/cron/client rpc/edge caller): 105 · REFERENCED ONLY BY OTHER SQL OR A VIEW OR A CODE MENTION: 68 · NO CALLER FOUND: 25

No caller found (25 names): caps_testflight_audit, claim_mission, feedback_quick_stats, get_build_changelog, get_daily_report, get_game_config, get_level_config, get_next_build_number, get_pipeline_monitor, get_pipeline_status, get_player_hud, get_player_rank, get_sng_status, is_room_member, join_sit_n_go_solo, mark_whatsapp_sent, notify_bug_fix_result, register_build, start_quick_poker, starter_pack_funnel_stats, summarize_daily_analytics, track_screen_size, update_bug_status, update_build_status, update_elo
