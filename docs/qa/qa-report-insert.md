# Recording a device pass into `qa_reports`

`qa_reports` has existed for months with **0 rows**. The build-508 device pass is row 1.

## Schema is sufficient as-is — no migration

| column | type | what goes in it |
|---|---|---|
| `project` | text, NOT NULL | `'Caps'` |
| `version` | text | `'2.7.0 b508 (5205bd2)'` — marketing version, **native** build number, and the commit the build was actually made from. There is no dedicated sha column and one is not needed; keeping all three in one string is what makes a row re-readable a year later. |
| `total_screens` | int | distinct screens exercised (device-pass-508 covers 7) |
| `total_issues` | int | failed checks |
| `critical_issues` | int | crash / stuck screen / cannot finish a hand / false chip claim |
| `compliance` | numeric | passed ÷ total × 100 |
| `report` | jsonb | the per-step results — see shape below |
| `auto_fix_prompt` | text | optional; leave null unless a fix is being handed straight to an agent |
| `created_at` | timestamptz | defaults to `now()` |

**Do not** write to `build_history`. It is dead (last write 2026-05-08, row `451` stuck
`in_progress` for three months) and reviving it re-creates a table that lies.

## Insert shape

Run via the Supabase MCP `execute_sql`, or psql. `report` carries the detail so the numeric
columns stay queryable:

```sql
insert into qa_reports
  (project, version, total_screens, total_issues, critical_issues, compliance, report)
values (
  'Caps',
  '2.7.0 b508 (5205bd2)',
  7,
  :total_issues,
  :critical_issues,
  round(100.0 * (33 - :total_issues) / 33, 1),
  jsonb_build_object(
    'protocol',    'docs/qa/device-pass-508.md',
    'build_sha',   '5205bd2',
    'native_build','508',
    'device',      'iPhone <model>, iOS <version>',
    'locale',      'he-IL',
    'run_by',      'Roye',
    'commits_behind_head', 47,
    'failures', jsonb_build_array(
      jsonb_build_object(
        'step', 9,
        'screen', 'placement 2P',
        'expected', 'edge cards not clipped',
        'actual', 'leftmost card cut off ~6px',
        'severity', 'major'
      )
    ),
    'not_covered', jsonb_build_array(
      'real multiplayer (2 devices)', '3P / 3 boards', 'Google sign-in + merge',
      'purchases / shop / battle pass', 'push notifications', 'Android'
    )
  )
);
```

## Reading it back

```sql
select version,
       compliance,
       total_issues,
       critical_issues,
       jsonb_array_length(report->'failures') as failures,
       created_at
from qa_reports
where project = 'Caps'
order by created_at desc;
```

## Why the numbers are worth keeping separate from the jsonb

`compliance`, `total_issues` and `critical_issues` are real columns so a trend across builds is
one query, not a jsonb crawl. The narrative belongs in `report`; the score belongs in columns.
