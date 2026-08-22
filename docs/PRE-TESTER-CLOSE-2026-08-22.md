# CAPS — PRE-TESTER-CLOSE: the last four (2026-08-22)

Roye's four rulings, all four done. Two of them turned out to be one bug wearing two faces, and
fixing the tie exposed the same mistake a third time on the same screen.

---

## MAP — carried forward, extended

- `vamos_handoffs` is the channel. Latest: id 102.
- **The two-branch boolean over a three-way outcome is a PATTERN in this codebase, not an incident.**
  `netChips > 0 ? win : loss` produced the tie-reads-as-defeat defect; the identical shape is still
  live one line away in the ELO call (§ reported). When a screen has three outcomes, grep for the
  ternaries before assuming there is only one.
- **A second source of truth is the real defect; the missing branch is only the symptom.** The
  headline decided from *boards won*, the sub-header from *chips*. Fixing the branch without
  merging the sources would have left them free to disagree again.
- **An explicit object-literal adapter silently drops every field you do not name.**
  `adaptRevealBoardsForReveal` is why the reveal could never show the data added to the payload.
- `IF <record> IS NOT NULL` in PL/pgSQL is true only when **every field** is non-null. On a table
  with any nullable column it is never true. Use `IF FOUND`.
- Instrument tally this sprint: **5 failures**, all named. Two were in the cue harness itself and
  both would have produced a *false pass*.

## 1 — A tie is its own outcome ⭐

**The third branch.** `results.tsx` now derives the outcome **once**, from the same source the
headline uses (`playerWins` vs `botWins`), and both lines read it:

| | copy | colour |
|---|---|---|
| win | `🏆 You beat {name}!` | `#c9a84c` gold — unchanged |
| loss | `Defeated by {name}` | `#ef5350` red — unchanged |
| **tie** | **`🤝 Tied with {name}`** | **`COLORS.mint`** |

**Not borrowing the win treatment: confirmed.** Mint is neither the win gold nor the loss red. It
is what the headline *directly above* already paints `TIE GAME`, so the two lines now agree in
words and in colour. **Motion: there is none to make say "tie"** — `mpResultHeader` is a static
`Text` with no animation. Stated rather than invented.

**Why it broke.** The sub-header was a two-branch ternary on `netChips > 0`, so a tie
(`netChips === 0`) fell into the loss branch. But the deeper fault was the **second source of
truth**: the headline decides from boards won and the sub-header decided from chips, and those two
disagree whenever boards tie but pots do not — a case the screen already knew about, since it
renders a `Tie bonus: +N chips` line for exactly it.

### Proven with two real clients reaching a tie

Not forced, not simulated — a genuine 2–2 hand between two live clients:

```
A screen: "TIE GAME | 2 — 2 | ... | 🤝 Tied with Guest | ▼ 10 ELO"
B screen: "TIE GAME | 2 — 2 | ... | 🤝 Tied with Host  | ▼ 10 ELO"
```

Headline and sub-header agree on both sides; **"Defeated by" appears nowhere**. 7/7 harness
assertions passed, zero page errors, zero supabase 4xx.

### Winner cue re-measured — both engines, DPR 3

Sampled from the painted `getComputedStyle` border of every card-sized element, across the whole
reveal:

| cue | webkit | chromium |
|---|---|---|
| **won — gold** | `3px rgb(255, 215, 0)` | `3px rgb(255, 215, 0)` |
| **field — mint** | `2px rgb(79, 214, 168)` | `2px rgb(79, 214, 168)` |
| **neutral** | `1px rgba(0, 0, 0, 0.22)` | `1px rgba(0, 0, 0, 0.22)` |
| distinct widths | **[3, 2, 1]** | **[3, 2, 1]** |

**All three still separate, and they separate in greyscale**: strip colour and 3 / 2 / 1 remain
three distinct widths. Measured at **DPR 3 on chromium** specifically, which is where `Card.tsx`
records the width channel collapsing at 2.5px. `Card.tsx` was not touched.

## 2 — The winning board names the opponent

**Where the payload is built:** `app/multiplayer-game.tsx`, in both the host build
(`buildRevealDataAndNavigate`) and the guest build (`buildGuestRevealDataAndNavigate`). Both had
the identical bug:

```js
botHandName: br.winnerIndex >= 0 && br.winnerIndex !== myIdx
  ? br.playerResults[br.winnerIndex]?.name || '' : '',    // '' on every board you WON
```

It is now the **best opposing hand whoever won**, selected **by score** so it stays correct at 3
and 4 players rather than only heads-up.

**⚠️ Correction to my own scoping in handoff 101.** I reported this as "the opponent's best cards
never reach the winner's client". That was wrong about the *names*: every player's evaluated
result was **already on the client** in `br.playerResults`. Nothing had to be transmitted to fix
the blank — it was a conditional dropping data that was already in hand.

**What I sent: the EVALUATED BEST FIVE, not hole cards.** `BoardRevealPayload.playerHands` gains
an optional `bestCards` — `[...playerCardsUsed, ...boardCardsUsed]`, 2 from hand + 3 from board,
exactly what solo precomputes. That payload is only ever sent **at showdown**, where it already
carries `cards`, so nothing new crosses the wire and **no private-phase channel is touched**. The
field is optional, so a guest on an older cached bundle degrades to the bare category instead of
breaking.

### Proven on two clients

```
before:  "Straight beats "           <- blank on every board you won
after:   "Three of a Kind beats One Pair | ✅ YOU WIN"
         "Full House beats Two Pair"   "Two Pair beats One Pair"
```

Verified on **both** clients across two separate two-client hands. **Solo unchanged: confirmed** —
`"Two Pair, Jacks and Sixes beats Pair of Fives"`, re-measured after every change in this sprint.

> ### ⚠️ Reported, not claimed: the rank-specific labels did NOT take effect in MP
> Solo prints `"Two Pair, Jacks and Sixes beats Pair of Fives"`; MP still prints `"Two Pair beats
> One Pair"`. I added `bestCards` to the payload and to both build paths, and found and fixed one
> real cause on the way — `adaptRevealBoardsForReveal` rebuilds an explicit literal and was
> dropping both best-card fields before they reached `<BoardReveal>`. The deployed bundle contains
> every edit (verified by reading it back: `playerBestCards:best5(s)` on the host,
> `n?.bestCards` on the guest). **It still renders the bare category, and I could not establish why
> within this sprint.** The enrichment was my own addition beyond the ask; **the ask — the winner's
> screen names the opponent's hand — is fixed and proven.** I am flagging the remainder rather than
> reporting it as delivered.

## 3 — The referral code no longer changes every visit

**Changed, exactly:** `create_referral_link(text)` — `SECURITY DEFINER`, `search_path = public`,
same signature, same return shape. The guard `IF v_link IS NOT NULL` became **`IF FOUND`**, and the
lookup gained a deterministic `ORDER BY`. Nothing else in the function moved.

`IF v_link IS NOT NULL` on a composite record is true only when **every** field is non-null;
`user_id` is NULL on **3,180 of 3,180 rows** because CAPS is device-anonymous and nothing sets it.
So the guard could never be true and the function INSERTed on every call.

### Idempotency proven

```
call 1 -> 9EB10160      rows created for that device: 1
call 2 -> 9EB10160
call 3 -> 9EB10160
```

Three calls, one code, **one row**. Before the fix, three calls meant three rows.

### Devices that already hold several — what happens to them

**No existing row was touched.** The fix changes which row is *read*, and stops new ones being
written. The device is served, in order:

1. a code with `conversions > 0` — provably shared, so a link already in someone's hands keeps working
2. otherwise the **oldest** row — held longest, likeliest to be the one shared

Rule 1 never fires today: **zero of 3,121 codes have ever been redeemed**, so no code is *provably*
the shared one — which is why the tiebreak exists at all, for the moment redemptions start.

Proven on the worst case in production — the device holding **32 codes**:

```
device a602-b8d6-78cb   codes held: 32   oldest: 78A8F1A3
returned: 78A8F1A3 · 78A8F1A3 · 78A8F1A3     (and no new row)
```

## 4 — Daily Missions retired

**Deactivated, not deleted**, exactly as the twelve unearnable achievements were:
`UPDATE daily_missions SET is_active = false`. **20 definitions kept**, with their titles, targets
and rewards; **5,622 `user_missions` rows kept**; `claim_mission_d` and `update_mission_progress`
**untouched**.

### It has never worked for anyone — measured, not assumed

| | |
|---|---:|
| `user_missions` rows | 5,622 |
| rows with **any** progress | **0** |
| completed | **0** |
| claimed | **0** |
| mission types the client can advance | **0 of 20** |

The cause is bigger than `bluff_1`: the client advances progress with `games_played`, `games_won`
and `boards_won`, and **not one of the 20 missions uses any of those types** — they use
`play/win/quick/streak/allIn/bluff/sng/social`. **No mission of any type could ever advance.**

### Routes and links removed

| | |
|---|---|
| `app/missions.tsx` | now a `<Redirect href="/" />` |
| Home — `assign_daily_missions` + `get_daily_missions` on every load | removed |
| Home — "Competition" card | no longer says "Missions"; shows leaderboard rank, which is where it has always navigated |
| Profile menu entry | already hidden 2026-07-20; unchanged |

**Why a redirect rather than deleting the file:** there is **no `app/+not-found.tsx`**, so removing
the route would send a tester who typed the URL to expo-router's unmatched-route fallback with no
guaranteed way back — a new defect in place of an old one. **Proven on live, both engines:**
`/missions` lands on `/` with **22 exposed controls**.

### What depends on the mission machinery

| depends on it | verdict |
|---|---|
| `update_mission_progress` | touches **only** `user_missions`, credits nothing, guarded by `econ_rate_ok`/`econ_bind_ok`. Now a no-op. Left in place. |
| `results.tsx` × 3 calls per hand | now no-ops. Left — removing them is scope, and they are guarded. |
| `delete_user_account`, `merge_guest_to_user`, `purge_user_data` | delete/move `user_missions` rows. Unaffected — the rows still exist. |
| `dashboard()`, `get_caps_launch_dashboard()` | count rows. Unaffected. |
| `smoke_test_caps()` | asserts `count(*) FROM daily_missions >= 10` — **rows, not active ones**. **Re-run after: still passes, "20 missions", score 10.** |
| `test_e2e_anonymous_flow()` | needs `assign_daily_missions_d` non-null; `'[]'::jsonb` satisfies it. Unaffected. |
| triggers / views | **none** |
| **battle-pass** | ⚠️ **It has its own "Daily Missions" section** — and it is **completely independent**. `stores/battlePassStore.ts` makes **zero** RPC calls; its missions come from a local `makeDailyMissions()` pool. Two different things share a name; only the DB one is retired, and the battle-pass section keeps working. |

**This is why "deactivate, do not delete" was the right instruction** — deleting the rows would have
broken `smoke_test_caps`.

---

# REPORTED, NOT FIXED

### ⚠️ A. A tie costs BOTH players 10 ELO — the same bug, one line over

`results.tsx:566` calls `update_leaderboard_elo(p_device_id, p_won)` with
**`p_won = revealData.netChips > 0`**. On a tie that is `false`, so a tie is submitted as a **loss**
and both players' rank drops. Visible on the very screen this sprint fixed:

```
TIE GAME | 2 — 2 | 🤝 Tied with Guest | ▼ 10 ELO
```

It is **the identical two-branch-boolean-over-three-outcomes shape** as the defect Roye ruled on,
and I found it only because I fixed the first one. Not fixed: it needs a tie path in
`update_leaderboard_elo`, which is the ranking rail and not one of the four rulings. It is
symmetric (both players lose the same 10), so it is wrong rather than unfair.

### B. MP rank-specific hand labels — see the boxed note in §2.

---

## FINAL CYCLE

Both engines × 320 / 375 / 393 / 1280 × 2, 3 and 4 boards. Every run carries the self-test that
plants a real overflow and a real clip and **aborts unless it catches both**:

```
SELF-TEST  planted overflow caught=true  planted clip caught=true
```

| engine | 320 | 375 | 393 | 1280 |
|---|---|---|---|---|
| **webkit** | 2p · **4 boards** | 4p · **2 boards** | 3p · **3 boards** | 4p · **2 boards** |
| **chromium** | 2p · **4 boards** | 3p · **3 boards** | 4p · **2 boards** | 2p · **4 boards** |

Each engine sees all four widths and all three board counts. Every cell walks the whole first
session: overlay → tutorial → P1 dealt → P2 partly placed → P4 ready armed → **P5 reveal** →
results → 22 routes → zero-chip state.

**Self-test caught its planted defects in every run: confirmed** — all eight printed
`planted overflow caught=true  planted clip caught=true`.

**What the cycle found: NOTHING.** 8 of 8 cells: **0 findings, 0 `console.error`**. `pageerror` was
0 on every webkit cell bar one (a single `AbortError` from the harness aborting in-flight requests
as it walks 22 routes) and 2–4 on chromium cells — all the autoplay `NotAllowedError`, which handoff
101 proved benign by measuring an idle page at 0 on both engines.

Two things the fixes touched were re-verified inside the loop rather than only in isolation:
`route /missions` now reports **path `/` with 22 exposed controls** on both engines, and `/results`
still reports 5–6 exposed controls with 0 unexposed.

## Instrument failures — 5, all named

1. **The cue harness sampled 2.5s into the reveal** and reported widths `[3,2,1]` built from the
   *wrong* 3px — a container border. The gold cue does not exist until a board resolves. It now
   samples across the whole reveal. **This would have been a false pass.**
2. **The cue harness printed top-N by frequency**, which hides the cue entirely: the won cards are
   the rarest bucket (3 against 36 neutrals). Now grouped by width. **Also a false pass.**
3. **Browser page crashes on three separate runs** — `Page crashed` navigating to `/leaderboard`
   (webkit 375), `Target page… has been closed` (webkit 1280 — the same cell that crashed last
   sprint), and `Execution context was destroyed` when a cue sample raced the reveal→results
   navigation. The last one is now guarded; all three were re-run to completion.
4. One `tests/beats-scope.mjs` run reported **zero** comparison lines, which looked like a solo
   regression. It had simply not reached `/results`; the re-run showed solo correct and rich. **Not
   filed as a defect.**

Plus one **mistake of mine, not the instrument**: `git add tests/` re-added the 22
deliberately-untracked harnesses — the same slip as last sprint. Reversed in `71288a2`. The
screenshots stayed out this time; last sprint's gitignore held.

## Production unchanged

`iap_enabled` **false** · `web_payments_enabled` **false** · `purchases` **0** · daily reward
**150** · `emergency_chips_amount` **200** · `hand_rake_pct` **5** · `rewarded_ad_chips` **100** ·
`record_reward` and its clamp untouched · `verify_jwt` untouched · no `app_config` key added,
deleted or edited · no `game_rooms` or `room_players` row edited · `Card.tsx` untouched.

**DB changes, in full:** `create_referral_link` (`IF FOUND` + deterministic `ORDER BY`), and
`UPDATE daily_missions SET is_active = false`. Nothing else.

**Cleaned:** 24 harness devices and 1 SQL probe device (`test-idem-probe`), across
`referral_links`, `referral_redemptions`, `user_missions`, `hand_history`, `chip_transactions`,
`daily_rewards`, `analytics_events`, `device_identity` and `leaderboard`. Also removed three
`test-as1-guard` rows left by a 2026-08-01 harness — one device with three codes 47 seconds apart,
an exact illustration of the bug fixed in §3.

Device bindings back to **3** (the real ones) · `test-` devices **0** · `referral_redemptions`
**0** · leaderboard **1,075**. Real player `6956-24d1-5ee4` **untouched** — 2,530 chips.

⚠️ **21 rows from the same window were left in place, deliberately**, on the same reasoning as last
sprint: they carry the 2,530-chip / zero-placement fingerprint, which is also exactly what a real
visitor produces who opens CAPS, takes the daily reward and leaves. Some are certainly mine; I
cannot separate them from a real visitor without guessing, and erasing funnel evidence is worse
than leaving a stale harness row.

## READY

**Yes — the four are done, and the loop found nothing afterwards.**

The tie now reads as a tie on both clients in a real 2–2 hand, and the winner cue survives the
change with all three widths separating in greyscale on both engines at DPR 3. The winning board
names the opponent, proven on both clients. A referral code is stable across visits, proven three
calls deep including on the device holding 32 of them. Daily Missions cannot be reached, and
nothing that depended on it broke — `smoke_test_caps` still passes because the definitions were
deactivated rather than deleted.

**Two things a tester will still meet, both reported not fixed and both outside the four:**

1. **A tie costs both players 10 ELO** (§A) — the same two-branch-boolean shape as the defect just
   fixed, one line away, on the very screen this sprint corrected. Symmetric, so wrong rather than
   unfair, and it is on the ranking rail.
2. **MP hand labels stay at the bare category** (§2 box) — cosmetic, solo is unaffected, and I have
   said plainly that I could not finish it rather than reporting it done.

Neither blocks a tester round. **When that round happens is Roye's call.**

*(handoff: `vamos_handoffs` id 102)*
