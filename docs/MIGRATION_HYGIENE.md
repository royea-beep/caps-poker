# CAPS — Migration History Hygiene
_2026-06-28_

## Problem
The DB simulations this cycle were applied via `apply_migration` (the only write path
available to the strategist), so ~15 throwaway QA sims got recorded as permanent
migrations. They did their job (proved bugs, then cleaned their own data) but they
**should not replay on a fresh branch**. If you `create_branch`, these will re-run.

## QA-JUNK migrations (safe to squash/ignore on a clean rebuild — they only created+deleted test data)
- `qa_sim_club_join_gating_test`
- `qa_sim_cleanup_1`
- `qa_sim_verify_both_fixes`
- `qa_sim_cleanup_2`
- `qa_sim_bug4_idempotency`
- `qa_sim_cleanup_3`
- `qa_verify_noncontiguous_seat_returned`
- `qa_cleanup_seat_sim`
- `qa_final_friend_flow_sim`
- `qa_final_cleanup_and_clubs_econ_check`
- `qa_full_game_flow_simulation`
- `qa_flow_cleanup_final`
- `qa_reverify_mp_flow_and_seat_edge`
- `qa_reverify_clubs_full`
- `qa_reverify_cleanup_and_ghost`
- `cleanup_mp_lobby_test_artifacts`, `cleanup_last_finished_test_room`, `cleanup_friends_clubs_qa_residue` (earlier cleanups)

## THE REAL migrations this cycle (these define live behavior — KEEP)
- `lobby_v2_public_private_and_seed_pool` — is_public column + ensure_public_lobby()
- `lobby_v2_join_leave_public_semantics` — join/leave public semantics + list_public_tables
- `lobby_v2_seed_public_pool` + `lobby_v2_schedule_pool_maintenance_cron`
- `friends_clubs_v1_schema` + `friends_clubs_v1_rpcs` + `friends_clubs_v1_club_tables_rpcs`
- `fix_join_table_seat_collision_and_club_gate`  ← BUG 1 + 2
- `bug3_heartbeat_and_ghost_eviction` + `schedule_evict_ghost_seats_cron`  ← BUG 3
- `bug4_club_game_ledger_idempotent_record`  ← BUG 4
- `reset_all_accounts_and_stats_clean_start` / `reset_all_accounts_clean_for_friends_final` — the friends reset

## Recommended action (next DB session, low priority)
Option A (cleanest): create a single consolidating migration file in the repo
`supabase/migrations/` that contains ONLY the "real" objects above (idempotent
CREATE OR REPLACE / ADD COLUMN IF NOT EXISTS), so a fresh `create_branch` reproduces
live state without the QA noise. The repo migration files are the reproducibility
source of truth — the live tracked-history is out of sync because sims were applied direct.

Option B (do nothing): the junk migrations are harmless on prod (already ran, data
cleaned). Only matters if/when you branch. Acceptable to defer.
