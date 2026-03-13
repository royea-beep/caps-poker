# Sprint-44 QA — Supabase Integration Test (20 Virtual Users)

**Date:** 2026-03-13
**Script:** `scripts/qa_supabase.js`
**Result:** 87/87 checks PASSED

## Test Phases

### Phase 1: Upsert 20 users → 20/20 OK
Inserted 20 virtual users with varied stats:
| # | Name | Device ID | Chips | Hands | Won | Biggest Win |
|---|------|-----------|-------|-------|-----|-------------|
| 1 | Alice | qa-dev-001 | 1450 | 12 | 8 | 200 |
| 2 | Bob | qa-dev-002 | 890 | 20 | 7 | 150 |
| 3 | Charlie | qa-dev-003 | 2100 | 35 | 18 | 350 |
| 4 | Diana | qa-dev-004 | 500 | 8 | 2 | 80 |
| 5 | Eve | qa-dev-005 | 3200 | 50 | 30 | 500 |
| 6 | Frank | qa-dev-006 | 1000 | 15 | 6 | 120 |
| 7 | Grace | qa-dev-007 | 1800 | 25 | 14 | 280 |
| 8 | Hank | qa-dev-008 | 320 | 5 | 1 | 50 |
| 9 | Ivy | qa-dev-009 | 2800 | 40 | 22 | 420 |
| 10 | Jake | qa-dev-010 | 4200 | 60 | 35 | 600 |
| 11 | Kate | qa-dev-011 | 750 | 10 | 4 | 100 |
| 12 | Leo | qa-dev-012 | 1650 | 22 | 12 | 250 |
| 13 | Mia | qa-dev-013 | 950 | 18 | 8 | 140 |
| 14 | Nick | qa-dev-014 | 2400 | 38 | 20 | 380 |
| 15 | Olivia | qa-dev-015 | 1200 | 16 | 9 | 180 |
| 16 | Pete | qa-dev-016 | 600 | 7 | 3 | 90 |
| 17 | Quinn | qa-dev-017 | 3500 | 55 | 32 | 550 |
| 18 | Rose | qa-dev-018 | 1100 | 14 | 7 | 160 |
| 19 | Sam | qa-dev-019 | 2600 | 42 | 24 | 400 |
| 20 | Tina | qa-dev-020 | 800 | 9 | 3 | 110 |

### Phase 2: Verify rows exist → 20/20 OK
Each row selected back and validated for correct field values.

### Phase 3: Update each user (+100 chips, +1 hand) → 20/20 OK
All 20 upserts with updated values succeeded.

### Phase 4: Verify updates reflected → 20/20 OK
Re-selected all rows, confirmed chips = original + 100, hands = original + 1.

### Phase 5: Leaderboard retrieval → 3/3 OK
- Returned exactly 20 rows
- Order correct: Jake (4300) at #1 down to Hank (420) at #20
- DESC ordering by total_chips verified

### Phase 6: Graceful degradation → 2/2 OK
- Wrong URL: `TypeError: fetch failed` — no crash, returns error object
- Empty key: No crash, returns error object
- App-level code (leaderboard.ts) wraps in try/catch → silent fail

### Phase 7: Cleanup → 2/2 OK
- DELETE policy added during Sprint-44
- All 20 qa-dev-* rows successfully deleted
- Leaderboard is now empty (0 real users)

## Findings
1. **Supabase connection works** — URL + anon key valid, all CRUD operations succeed
2. **Upsert on device_id conflict works** — both insert and update paths functional
3. **Leaderboard ordering correct** — top 20 by total_chips DESC
4. **Graceful degradation confirmed** — wrong URL/key = no crash
5. **RLS DELETE policy was missing** — added in Sprint-44 (migration 20260313000001)

## RLS Policies (leaderboard table)
| Policy | Operation | Rule |
|--------|-----------|------|
| leaderboard_select | SELECT | true (public) |
| leaderboard_insert | INSERT | true (public) |
| leaderboard_update | UPDATE | true (public) |
| leaderboard_delete | DELETE | true (added Sprint-44) |
