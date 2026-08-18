# 2026-08-18 — The hung `tsc` explained everything, CI is green, and the live hand stopped at READY

**The 12-hour background `tsc` was the whole story.** It is gone, and local `tsc` returned **exit 0**
on the first try — so piece 4's types are clean, and every `0xC0000005`, the V8 fatal and the
9-minute hang were that process competing for memory. 54 `node.exe` remain (~5.4 GB) but none is a
`tsc`; they are the harness and MCP servers.

**CI is green on `0612364`** (Web Deploy · Vercel, success). The iOS Simulator job is the known
cancelled-by-design one.

**Deps parity is confirmed, not assumed.** `runHostReveal`'s `[mpServer, config]` is complete: the
extracted body references no other state. The one hit for `boardCount` is a property *name*
(`boardCount: boardResults.length`), not a read of the outer variable, and `isHost` only ever
guarded the effect, which kept it.

## The live hand got most of the way and stopped

Two clients created and joined a private table, the server dealt, and both reached the game:

```
A: table code = B5AZ
[RT SERVER] Starting hand 1 (server-dealt) {"playerCount":2,"boardCount":4,"handNo":1}
[RT CLIENT] HAND_READY received {"handId":1}
hostInGame= true  guestInGame= true
A: board count = 5
A: READY visible = false      <-- stopped here
```

`READY` never appeared, so no seat submitted, nothing resolved, and no rows were written.

**Two harness faults, both mine to have found earlier.** It defaults to `BASE=http://localhost:8093`
— a dev server that was never running, which is why the first two attempts failed instantly at the
create button while the aria-label was in fact present and correct on production. And the private
table flow had moved to `/lobby/private` with the label `Create a 2-player private table`. Both are
now fixed. The remaining blocker is the placement step: the harness reports `board count = 5` at a
4-board table, so its board locator is matching a container as well, and the 16-card placement never
completes.

## State after the run — flag OFF

```
game_hands 2 -> 3   the hand WAS server-dealt, placements 0 seats, resolved false
hand_history 155    UNCHANGED - nothing written, by either party
chip_transactions 5044 -> 5052 (+8)  NOT from this hand; unexplained, see below
```

The flag was on for three short windows and off before each diagnosis, exactly as the design
intends: one statement, no deploy.

=== STRATEGIST HANDOFF — FLIP AND PROVE ===
HUNG PROCESS: no `tsc` process remained — already gone. 54 node.exe (~5.4 GB) are the harness and
  MCP servers, not tsc. LOCAL TSC BEHAVES AGAIN: exit 0 first try, CI-equivalent (deleted
  supabase/functions/_shared, ran tsc, regenerated). THAT WAS THE CAUSE of every crash last run.
TASK 1 CI:
  - CI on 0612364: GREEN — Web Deploy (Vercel) completed/success. iOS Simulator Smoke
    completed/cancelled, the known cancelled-by-design job.
  - runHostReveal deps parity: CONFIRMED COMPLETE. [mpServer, config] is enough — the extracted body
    references no other component state; the single `boardCount` hit is a property NAME
    (boardCount: boardResults.length), not the outer variable; isHost only guarded the effect and
    the effect kept it.
  - red? no.
TASK 2 LIVE HAND: ATTEMPTED, NOT COMPLETED.
  - flag flipped to true? YES, three times; OFF after each.
  - both reach /results? NO. Both reached /multiplayer-game with a SERVER-DEALT hand
    (Starting hand 1 (server-dealt) playerCount 2 boardCount 4; guest HAND_READY handId 1), then
    READY never became visible and the run ended there.
  - hand_history exactly 2 rows? NO ROWS AT ALL — 155 before, 155 after. Nothing written by either
    the server or results.tsx, because no hand completed.
  - one hand_net per player? N/A — no hand completed.
  - reveal cards vs server's judgement? NOT REACHED.
  - did the host evaluate anything? NOT REACHED — no adjudication ran on either side.
  - did submit_placements fire? NO. game_hands shows the dealt hand with ZERO seats submitted and
    resolved_at null. It has still never been exercised from the app.
  - engines: Chromium only.
TASK 3: flag flipped BACK before every diagnosis? YES, all three times.
  WHAT FAILED — the harness, not the product, as far as this run can tell:
   1. tests/mp-lobby-2client.mjs defaults to BASE=http://localhost:8093, a dev server that was not
      running. The first two attempts failed instantly at the create button while the aria-label
      was present and correct on production. FIXED by running with BASE=https://caps.ftable.co.il.
   2. The private-table flow had moved to /lobby/private with the label
      "Create a 2-player private table". FIXED in the harness.
   3. STILL BLOCKING: the placement step. The harness reports "board count = 5" at a 4-board table,
      so its board locator matches a container too, the 16-card placement never completes, and READY
      never appears. That is the next thing to fix.
FLAG STATE AT END OF RUN: FALSE. Nothing was proven live, so leaving it on would expose real players
  to an unproven path for no gain.
MAP — new:
  tests/mp-lobby-2client.mjs — BASE defaults to localhost:8093; ALWAYS pass BASE=https://caps.ftable.co.il
  private table flow: /lobby/private · aria-labels "Create a N-player private table",
    "Enter a table code", "Join by code"; heading text "CREATE A TABLE TO SHARE"
  the app DOES mount on production under Playwright (aria-labels enumerated) — the old
    "web preview can't mount" note applies to the dev transform, not to caps.ftable.co.il
  harness board locator over-counts: 5 at a 4-board table
NOT ATTEMPTED (all true): drop test | 25% case | p_full | harness | app_config sweep | tsconfig
  tripwire.
DB: ZZS2 intact with 2 seats; 11 public rooms untouched; 51 old quick_poker rows untouched.
  game_hands 3, hand_history 155, backup 649, flag false. Room B5AZ was created by the harness and
  left in place (rooms are not deleted).
tsc: EXIT 0 | CI: 0612364 green.
HANDOFF: written to vamos_handoffs FIRST this time, then the file, then the reply.
WHAT I DID NOT CHECK: why chip_transactions rose 5044 -> 5052 (+8) during the run — no hand
  completed, so those are not hand nets; likely welcome/bonus grants from the two fresh anon
  devices the harness created, but I did not confirm it; whether READY is genuinely absent or just
  not matched by the harness locator, which decides whether item 3 above is a harness bug or a real
  one; and I never saw a reveal, so the central assertion is still unproven.
=== END ===
