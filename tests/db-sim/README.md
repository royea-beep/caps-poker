# Layer 1 — DB-sim

Reversible RPC simulations against the live Supabase project
`gxrpunvhjcrzqnitbqah` (caps-poker).

## Why

`tsc` + `jest` only cover compile-time + unit logic. The bugs that have
shipped this year (lobby seat-collision 500, club-gate hole, club-result
non-idempotency) were all **runtime contract** bugs that pass tsc.
Layer 1 catches them by calling the real RPCs in user-sequence with
marker identities, asserting state, and **cleaning up to zero residue**.

## Identity convention

- `device_id` prefix: `simdev_<runId>_<seat>` (e.g. `simdev_qa20260628_0`)
- Display name prefix: `SIM_`

The prefix lets `cleanup()` find every row this run touched. The runId is
the GIT_SHA + a short random suffix so concurrent runs don't collide.

## Adding a sim

Drop a new `.mjs` next to `lobby_seat.mjs`. Each sim is a default-exported
async function that receives `{ sb, runId, asserts }` and must:
1. Mutate only rows it created (no shared fixtures).
2. Use `asserts.eq(actual, expected, label)` so the report aggregates.
3. Be idempotent — re-running on the same runId must not duplicate state.
4. Register every row it touches via `register(table, id)` so `cleanup()`
   reaps it without owning a table-by-table delete script.

`run.mjs` discovers every `.mjs` in this dir, runs them in series,
asserts ZERO residue at the end, and exits non-zero if anything failed.
