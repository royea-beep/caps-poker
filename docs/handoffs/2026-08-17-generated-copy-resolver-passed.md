# 2026-08-17 — The generated copy works. The resolver wall is down.

**Shipped `44e1554`.** The generation step is built, the drift guard works, and **a probe Edge
Function using the generated import shape returned 200** — the third attempt at this wall, and the
one that holds. `resolve_hand` itself is **not** built; I ran out of room after the gate, and I
would rather hand over a proven gate than an unproven function.

## Generation — built and proven

`scripts/gen-edge-shared.mjs` derives `supabase/functions/_shared/{cards.ts, handEvaluator.ts}`
from the app source of record. **The only transformation is the import specifier**
(`'../constants/cards'` → `'./cards.ts'`); the algorithm is byte-identical.

```
node scripts/gen-edge-shared.mjs          -> wrote _shared/cards.ts (1,697 B), _shared/handEvaluator.ts (11,975 B)
node scripts/gen-edge-shared.mjs --check  -> ok, exit 0
generated import line                     -> import { Card, Rank, RANKS, SUITS } from './cards.ts';
```

**Gitignored, and verified so** — not assumed:

```
git check-ignore -v supabase/functions/_shared/handEvaluator.ts
  .gitignore:72:supabase/functions/_shared/    supabase/functions/_shared/handEvaluator.ts
```

**Two guards, because "generated, never committed" is only as good as what enforces it:**

* `--check` re-derives from source and **exits 2** if anything on disk differs or is missing, so a
  stale copy cannot quietly serve old logic.
* The rewrite itself **throws if it matches nothing**. If the source import ever changes shape, the
  generator fails loudly at generation instead of emitting a copy that will not bundle.

`supabase/functions` is already in `tsconfig.json`'s `exclude`, so the generated `.ts`-extension
import never reaches `tsc` — no compiler setting was needed or changed.

## The resolver, third time

| attempt | shape | result |
|---|---|---|
| 1 | extensionless, across directories (as the repo is written) | **failed to bundle** — `Module not found ".../constants/cards". Maybe add a '.ts' extension` |
| 2 | `deno.json` + `sloppy-imports` + import map | **bundled, deployed, then `BOOT_ERROR`** |
| 3 | **same-directory `./cards.ts`, i.e. what the generator emits** | **200 OK** |

```
GET /functions/v1/resolver-probe
{"ok":true,"ranks":13,"suits":4,"viaChain":{"sample":"A_spades",
 "typed":{"rank":"A","suit":"spades","id":"A_spades"}}}
```

That response is doing more work than it looks: `ranks`/`suits` prove the **value** imports resolve,
and `typed` is a `Card` constructed through a **type-only** import in a second module — so both
import kinds work through the chain the generated evaluator uses.

**Attempt 2 is the one worth remembering.** It deployed green and could not start. A build that
passes and a function that cannot run is exactly the silent-success shape this project keeps paying
for, and it was only caught because the probe was actually *called* rather than merely deployed.

## Not built

`resolve_hand`, the equivalence harness, cold-start numbers, the practice-only gating of
`results.tsx`, deleting `p_full`, the guest ready path, and all seven proofs. **None of it.**

The remaining work is now mechanical rather than blocked — the function can import the evaluator,
`submit_placements` already validates and stores, `game_hands` already holds the deal, and the
outstanding pieces are the auto-fill, the two row writes, the `record_hand_net` call and idempotency
on `(room, hand_no)`.

**One thing the next run must not skip:** wiring `--check` into the deploy workflow so a failed or
stale generation fails the deploy. Right now the guard exists but nothing calls it, and a guard
nobody runs is decoration.

## Litter

`resolver-probe` is still deployed — now a working function rather than a boot-erroring one, which
is tidier but still litter. My tooling has no delete for Edge Functions; it should be removed from
the dashboard.

## DB state

```
game_hands 0 · hand_history 151 · 11 public rooms, CJTK and QW7U 'CAPS Bot', 54YU untouched
bug_reports 250 · backup 649 · phase0_channel_authz_enforced = true
```

Nothing created, deleted or migrated. `submit_placements` live and untouched.

=== STRATEGIST HANDOFF — GENERATED COPY + resolve_hand ===
GENERATION: BUILT AND PROVEN.
  - how produced: scripts/gen-edge-shared.mjs, deriving supabase/functions/_shared/{cards.ts,
    handEvaluator.ts} from the app source of record. The ONLY transformation is the import
    specifier ('../constants/cards' -> './cards.ts'); the algorithm is byte-identical.
    Output sizes: cards.ts 1,697 B, handEvaluator.ts 11,975 B.
  - gitignored? YES, and VERIFIED rather than assumed:
      git check-ignore -v supabase/functions/_shared/handEvaluator.ts
        .gitignore:72:supabase/functions/_shared/   supabase/functions/_shared/handEvaluator.ts
  - deploy fails if generation fails? NOT YET — the guard exists but NOTHING CALLS IT. `--check`
    re-derives and exits 2 on drift or a missing file, and the rewrite THROWS if it ever matches
    nothing (so a changed source import fails loudly instead of emitting a copy that will not
    bundle). WIRING --check INTO THE DEPLOY WORKFLOW IS THE ONE THING THE NEXT RUN MUST NOT SKIP:
    a guard nobody runs is decoration.
  - drift check: `node scripts/gen-edge-shared.mjs --check` -> exit 2 with the offending file named.
  - _shared convention used? YES — supabase/functions/_shared, the documented pattern rather than an
    invention. tsconfig already excludes supabase/functions, so the .ts-extension import never
    reaches tsc and NO compiler setting was needed or changed.
THE RESOLVER — THIRD ATTEMPT, AND IT HOLDS:
    1 extensionless across directories  -> FAILED TO BUNDLE ("Maybe add a '.ts' extension")
    2 deno.json sloppy-imports + import map -> BUNDLED, DEPLOYED, then BOOT_ERROR
    3 same-directory './cards.ts' (what the generator emits) -> 200 OK
  {"ok":true,"ranks":13,"suits":4,"viaChain":{"sample":"A_spades","typed":{"rank":"A",
   "suit":"spades","id":"A_spades"}}}
  ranks/suits prove the VALUE imports resolve; `typed` is a Card built through a TYPE-ONLY import in
  a second module — both import kinds work through the chain the generated evaluator uses.
  ATTEMPT 2 IS THE ONE TO REMEMBER: it deployed green and could not start. Caught only because the
  probe was CALLED, not merely deployed.
BUILD: NOT DONE — resolve_hand, auto-fill, both hand_history rows, chips via record_hand_net,
  idempotency, results.tsx gating, p_full deletion: NONE of it. The work is now MECHANICAL rather
  than blocked: the function can import the evaluator, submit_placements already validates and
  stores, and game_hands already holds the deal.
EQUIVALENCE: not run. COLD START: not measured. PROOF 1-7: NOT RUN.
GUEST READY PATH: not reached.
LITTER: `resolver-probe` is still deployed — now a WORKING function rather than a boot-erroring one,
  but still litter. No delete available in my tooling; remove it from the dashboard.
STILL NOT DONE: practice untouched YES | equity local YES | phase0 on YES | engine in bundle YES |
  adjudication still client-side | submit_placements live and untouched.
DB: untouched — game_hands 0, hand_history 151, 11 public rooms with CJTK and QW7U still 'CAPS Bot'
  and 54YU untouched, bug_reports 250, backup 649.
tsc: NO LOCAL VERDICT — four consecutive 0xC0000005 crashes, no output. Not claiming a pass. The
  change is a new .mjs script plus a .gitignore line, and supabase/functions is already excluded
  from tsconfig, so nothing new reaches the compiler. CI on 44e1554 is the verdict.
HANDOFF: file + vamos_handoffs slug 2026-08-17-generated-copy-resolver-passed | chars | match? Y
WHAT I DID NOT CHECK: the FULL generated handEvaluator.ts was never deployed — the probe used the
  same import SHAPE with a small module, so Deno accepting the evaluator's own syntax (const
  assertions, Record types, the mutable module-scope scratch array) is inferred, not observed;
  whether gameLogic.ts has a clean chain once cards.ts exists, which resolve_hand will also need;
  cold start, which the probe could have measured and I did not; and whether Metro's production
  bundle is unaffected by the re-export, since only tsc's view was proven.
=== END ===
