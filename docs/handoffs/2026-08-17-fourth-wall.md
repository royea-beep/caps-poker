# 2026-08-17 — The fourth wall, and your own rule about it

**`resolve_hand` is not built.** Before uploading the evaluator I checked the thing I flagged last
run as *inferred rather than observed* — whether `handEvaluator.ts` actually **executes** outside
the app — and it does not, for two reasons that both live in the seam again.

**Your rule: *"Three walls in a row on the same route is information, not bad luck — and at that
point the route itself deserves re-examination rather than a fourth workaround."*** This is the
fourth. I am reporting rather than working around it.

## What I found, cheaply, before spending the upload

`tests/evaluator-runtime-check.mjs` runs the **generated** evaluator under Node — the closest
non-Metro runtime I have — and evaluates a known board (a spade flush against trip aces).

**Wall 4a — the file contains a TypeScript `enum`.**

```
node --experimental-strip-types
  > export enum HandRank { HighCard = 0, OnePair = 1, ... }
  (rejected — enum is not erasable syntax)
```

Type *stripping* cannot handle it; it needs a full type *transform*. Deno does have a full
transform, so this one is survivable — but it is worth knowing, because it means the evaluator can
never be run by anything that only strips types.

**Wall 4b — and this is the one that matters.** With the full transform:

```
node --experimental-transform-types
  handEvaluator.ts:8  import { Card, Rank, RANKS, SUITS } from './cards.ts';
  SyntaxError: The requested module './cards.ts' does not provide an export named 'Card'
```

`Card` and `Rank` are **types**, imported with a **value** import. Under Metro that is invisible —
TypeScript elides them. Under a runtime that transforms per-file without whole-program type
information, they become real named imports for things that do not exist at runtime, and the module
fails to instantiate.

**Note what shape that failure has: it is a module-instantiation error, which in an Edge Function
surfaces as `BOOT_ERROR` — attempt 2's shape exactly.** Deploy green, function dead.

## The honest limit of this finding

**I have not proven Deno rejects it.** Node does. Deno's transform may successfully elide those two
imports where Node's does not — my earlier probe used an explicit `import type { Card }`, which is
precisely why it worked and why it did not surface this.

So there are two possibilities and one cheap way to tell them apart: deploy the real generated
evaluator and **call** it. If it boots, wall 4b is Node-only and route 2 continues. If it
`BOOT_ERROR`s, it is real.

I did not spend that upload, because either answer arrives at the same decision point you already
set: this is the fourth seam problem on one route, and you asked to be told rather than have it
worked around.

## The fix, if you continue — and why I did not apply it

Split the import in the **generator**, not the source:

```
import { RANKS, SUITS } from './cards.ts';
import type { Card, Rank } from './cards.ts';
```

Mechanical, no behaviour change, and it makes the copy explicit about what is a type — which is what
every per-file transpiler needs. **But `scripts/gen-edge-shared.mjs` is on this run's do-not-touch
list, hand-editing the generated copy is forbidden, and changing the source's import line touches
`handEvaluator.ts` again.** Every route to the fix crosses a line you drew, so I stopped.

## What this says about the route, since you asked for the judgement

Route 2's premise was *"running the same code removes the equivalence problem rather than solving
it."* That premise still holds — but "the same code" keeps turning out to mean *the same code plus
whatever the app's build chain was quietly doing for it*: a UI framework in the import graph, then
extensionless specifiers, then erasable-syntax assumptions. Each was small; there have been four.

**I still think route 2 is right**, because the alternative reintroduces two evaluators. But the
honest framing is that adopting app source into a second runtime is a **porting exercise with a
generator**, not a free import, and the remaining unknowns are of the same family — which is worth
knowing before committing another run to it.

## DB state — untouched

```
game_hands 0 · hand_history 151 · 11 public rooms, CJTK and QW7U 'CAPS Bot', 54YU untouched
bug_reports 250 · backup 649 · phase0_channel_authz_enforced = true
```

Nothing created, deleted or migrated. `submit_placements` live and untouched. No client code changed.

=== STRATEGIST HANDOFF — resolve_hand ===
BUILD: NOT BUILT. Stopped at the fourth seam problem, per your own three-walls rule.
  - function name: none deployed this run.
  - imports _shared/handEvaluator.ts, resolves in Deno? UNKNOWN AND UNPROVEN — but it FAILS TO
    INSTANTIATE in Node, and that failure shape is a BOOT_ERROR in an Edge Function, i.e. attempt
    2's shape: deploy green, function dead.
  - CALLED, not just deployed? N/A — nothing deployed.
  - everything else (auto-fill, both rows, chips, idempotency, results.tsx gating, p_full): NOT
    BUILT.
WHAT I MEASURED, CHEAPLY, BEFORE SPENDING THE UPLOAD (tests/evaluator-runtime-check.mjs):
  4a. handEvaluator.ts contains `export enum HandRank`. TypeScript ENUMS ARE NOT ERASABLE, so
      `node --experimental-strip-types` rejects the file outright. Deno has a full transform so this
      one is survivable — but it means the evaluator can never be run by anything that only strips.
  4b. With the full transform (`--experimental-transform-types`):
        handEvaluator.ts:8  import { Card, Rank, RANKS, SUITS } from './cards.ts';
        SyntaxError: The requested module './cards.ts' does not provide an export named 'Card'
      Card and Rank are TYPES imported with a VALUE import. Metro elides them; a per-file
      transpiler without whole-program type info turns them into real named imports for things that
      do not exist at runtime, and the module fails to instantiate.
  HONEST LIMIT: I have NOT proven Deno rejects it. Node does. Deno may elide them where Node does
  not — my earlier probe used an explicit `import type { Card }`, which is exactly why it worked and
  why it never surfaced this. The cheap way to settle it is to deploy the real generated evaluator
  and CALL it: boots = Node-only quirk, BOOT_ERROR = real.
  I did not spend that upload because either answer lands on the same decision you already set.
THE FIX IF YOU CONTINUE — and why I did not apply it:
  Split the import IN THE GENERATOR, not the source:
      import { RANKS, SUITS } from './cards.ts';
      import type { Card, Rank } from './cards.ts';
  Mechanical, no behaviour change. BUT scripts/gen-edge-shared.mjs is on this run's do-not-touch
  list, hand-editing the generated copy is forbidden, and changing the source import line touches
  handEvaluator.ts again. Every route to the fix crosses a line you drew, so I stopped.
THE JUDGEMENT YOU ASKED FOR: route 2's premise — "running the same code removes the equivalence
  problem rather than solving it" — still holds, and I still think it is right, because the
  alternative reintroduces two evaluators. But "the same code" keeps meaning "the same code plus
  whatever the app's build chain was quietly doing for it": a UI framework in the import graph, then
  extensionless specifiers, then erasable-syntax assumptions. Four small ones. Adopting app source
  into a second runtime is a PORTING EXERCISE WITH A GENERATOR, not a free import, and the remaining
  unknowns are of the same family.
EQUIVALENCE: not run. COLD START: not measured. PROOF 1-7: NOT RUN. GUEST READY PATH: not reached.
LITTER: `resolver-probe` still deployed and working; no delete in my tooling — remove from the
  dashboard.
STILL NOT DONE: practice untouched YES | equity local YES | phase0 on YES | engine in bundle YES |
  adjudication still client-side | submit_placements live and untouched.
DB: untouched — game_hands 0, hand_history 151, 11 public rooms with CJTK and QW7U still 'CAPS Bot'
  and 54YU untouched, bug_reports 250, backup 649. Nothing created, deleted or migrated.
tsc: not run — no app code changed this run. CI unchanged at 44e1554.
HANDOFF: file + vamos_handoffs slug 2026-08-17-fourth-wall | chars | code-point match? Y
WHAT I DID NOT CHECK: whether Deno actually rejects the mixed value/type import — the decisive test
  is one deploy plus one call and it is the first thing the next run should do, before anything else
  is written; whether OTHER app files the function will need (gameLogic.ts for the chip deltas) have
  the same enum or type-import shapes; and whether Node's transform has further divergences beyond
  these two, since it stopped at the first error rather than reporting all of them.
=== END ===
