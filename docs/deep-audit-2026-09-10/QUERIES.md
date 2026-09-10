# The queries behind every number in this audit (run on gxrpunvhjcrzqnitbqah unless stated)

Quote a number from this audit only after re-running its query. All read-only.

```sql
-- GROUND TRUTH (devices / played / hands / bindings / purchases / max chips / gap)
select
 (select count(*) from leaderboard)                                   as devices,        -- 403
 (select count(*) from leaderboard where games_played > 0)            as have_played,    -- 25
 (select count(*) from leaderboard where hands_played > 0)            as have_played_alt,-- 26
 (select count(distinct device_id) from hand_history)                 as hh_devices,     -- 10
 (select count(*) from hand_history)                                  as hands,          -- 78
 (select count(*) from device_identity)                               as bindings,       -- 14
 (select count(*) from purchases) + (select count(*) from chip_purchases) as purchases,  -- 0
 (select max(chips) from leaderboard)                                 as max_chips,      -- 3250
 (select sum(chips) from leaderboard)                                 as float_chips,    -- 812400
 (select sum(amount) from chip_transactions)                          as ledger_sum,     -- 812400
 (select sum(chips) from leaderboard) - (select sum(amount) from chip_transactions) as gap; -- 0

-- OBJECT COUNTS
select
 (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public') as functions,           -- 198
 (select count(distinct proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public') as names, -- 188
 (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relkind='r') as tables, -- 73
 (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relkind='v') as views,  -- 12
 (select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not tgisinternal) as triggers, -- 8
 (select count(*) from pg_policies where schemaname='public') as policies,   -- 100
 (select count(*) from cron.job) as cron_jobs,                               -- 31
 (select max(id) from vamos_handoffs) as handoff_max, (select count(*) from vamos_handoffs) as handoff_rows; -- 209 / 207

-- WHAT ANON CAN READ (the probe that matters; a grant alone proves nothing)
set role anon;
select 'v_harness_devices_v2', count(*) from v_harness_devices_v2          -- 8
union all select 'v_grant_without_session', count(*) from v_grant_without_session  -- 7, with device_id + total_chips
union all select 'chip_transactions_prereset_20260901', count(*) from chip_transactions_prereset_20260901; -- 4237
-- and the contrast: select count(*) from v_harness_devices;  -> permission denied for view

-- CRON HEALTH (7 days)
select j.jobid, j.jobname, count(d.runid) runs, count(*) filter (where d.status='failed') failed, max(d.start_time) last
from cron.job j left join cron.job_run_details d on d.jobid=j.jobid and d.start_time > now()-interval '7 days'
group by 1,2 order by 1;
-- last failure ever, per job (all four push jobs: 2026-04-12/13, none since)
select jobid, max(start_time) filter (where status='failed') from cron.job_run_details group by 1;

-- FUNCTION CALLERS (the DB half; the repo half is grep -rE "rpc\(['\"]NAME['\"]" plus grep -w NAME)
with f as (select p.oid, p.proname, p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public')
select f.proname,
 (select count(*) from f g where g.oid<>f.oid and g.prosrc ilike '%'||f.proname||'%') by_fns,
 (select count(*) from cron.job j where j.command ilike '%'||f.proname||'%') by_cron,
 (select count(*) from pg_trigger t where not t.tgisinternal and t.tgfoid=f.oid) trig,
 (select count(*) from pg_views v where v.schemaname='public' and v.definition ilike '%'||f.proname||'%') by_views
from f order by 1;

-- LAST WRITE PER TABLE (tables with a timestamp column)
-- see DB-OBJECTS.md; uses query_to_xml(format('select max(%I)::date from public.%I', ts_col, tbl), false, true, '')

-- MIGRATION LEDGER vs FILES
-- Supabase MCP list_migrations (≈330 rows) vs  ls supabase/migrations | wc -l  (43)
-- newest ledger row 20260908213547 close_submit_score_chip_faucet — file only on branch claude/vamos-caps-align-celebration-flppo0
```

Repo-side measurements:

```bash
git rev-list --count origin/main..origin/claude/vamos-caps-align-celebration-flppo0   # 33
git diff --name-only origin/main...origin/claude/vamos-caps-align-celebration-flppo0 -- supabase/migrations  # 1 file
sha256sum assets/sounds/boardWin.wav assets/sounds/boardLose.wav assets/sounds/revealStart.wav  # identical
NODE_OPTIONS=--max-old-space-size=8192 npx jest --ci --silent   # 2846 passed, 53 suites, 253 s
curl -s -o /dev/null -w '%{http_code} %{size_download}\n' https://caps.ftable.co.il/nope.png   # 404 79
```

GitHub: workflows list (19 registered) and per-workflow `list_workflow_runs?per_page=1` (see WORKFLOWS.md). Empire HQ (vjxqlqtlywovnbidovit): `select bot_landing_brief('caps-poker')` — alive, risks section stale.
