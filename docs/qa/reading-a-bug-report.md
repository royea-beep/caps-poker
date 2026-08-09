# Reading a tester bug report

Since iteration 5 every `bug_reports` row carries `breadcrumbs`, `console_logs`, `session_id`
and a build identifier — proven landing. This is how to read them.

**This is a query set, not a UI, and that is deliberate.** A dashboard would be a fourth
half-built internal system next to `build_history` (dead), `qa_reports` (1 row) and
`error_logs` (0 rows). These four queries are the whole tool. Run them in the Supabase SQL
editor or via MCP `execute_sql`. Nothing here ships in the app bundle.

---

## 1. The inbox — what came in

```sql
select id,
       created_at at time zone 'Asia/Jerusalem' as local_time,
       tester_name,
       ai_severity,
       url as screen,
       coalesce(device_info->>'native_build', device_info->>'web_build',
                device_info->>'web_bundle', '(no build id)') as build,
       device_info->>'platform' as platform,
       left(description, 90) as description
from bug_reports
where project = 'caps-poker'
order by created_at desc
limit 30;
```

`build` falls back native → commit sha → bundle hash. `(no build id)` means the report came
from a build made before 2026-08-09 — those cannot be attributed.

---

## 2. The trail — what the tester did before reporting

This is the question the viewer exists to answer.

```sql
select b.created_at at time zone 'Asia/Jerusalem' as reported_at,
       b.description,
       crumb.ord,
       crumb.value->>'screen' as screen,
       to_timestamp(((crumb.value->>'ts')::bigint)/1000) at time zone 'Asia/Jerusalem' as step_time
from bug_reports b
cross join lateral jsonb_array_elements(coalesce(b.breadcrumbs, '[]'::jsonb))
                   with ordinality as crumb(value, ord)
where b.id = :report_id
order by crumb.ord;
```

If it returns nothing, the report predates the iteration-5 wiring — say so rather than
concluding the tester did nothing.

---

## 3. The session — richer than the breadcrumb list

`analytics_events` already holds far more than the crumb trail, and `session_id` joins them.
This is where friction signals (`rage_tap`, `stuck_dwell`, `screen_abandon`) show up — the
ones a tester does not remember and will not report.

```sql
select e.created_at at time zone 'Asia/Jerusalem' as t,
       e.event_name,
       e.screen,
       e.properties->>'native_build' as native_build,
       e.properties->>'web_build'    as web_build
from bug_reports b
join analytics_events e on e.session_id = b.session_id
where b.id = :report_id
order by e.created_at;
```

Roye's 2026-08-09 09:36–09:37 session is the worked example: two `rage_tap` rows around the
reveal → results transition that he did not mention in his own summary. **The data caught
friction his memory did not.** That is the entire reason to run this query.

---

## 4. Crashes in the same session

```sql
select c.created_at at time zone 'Asia/Jerusalem' as t,
       c.last_screen, c.last_action,
       jsonb_array_length(coalesce(c.step_log,'[]'::jsonb)) as steps,
       c.device->>'native_build' as native_build
from bug_reports b
join crash_reports c on c.device_id is not distinct from b.device_id
where b.id = :report_id
  and c.created_at between b.created_at - interval '10 minutes'
                       and b.created_at + interval '2 minutes'
order by c.created_at;
```

⚠️ **This join is weak and will often return nothing.** `crash_reports.device_id` is NULL on
all 135 historical dirty-shutdown rows, so it matches only rows written after the G2 work
reaches a build. Treat an empty result as "unknown", never as "no crash".

---

## Console logs

`console_logs` is captured but was **empty (0 lines)** in the only verified send. The wiring is
proven; that it captures real output under real use is not. Check it on the first genuine
tester report before relying on it:

```sql
select jsonb_array_length(coalesce(console_logs,'[]'::jsonb)) as lines, console_logs
from bug_reports where id = :report_id;
```
