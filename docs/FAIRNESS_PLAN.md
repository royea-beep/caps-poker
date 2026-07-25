# CAPS Poker — Provably-Fair Shuffle & Server-Authoritative Deal — PLAN

> **Status: research / spec only. No implementation.** 2026-07-25.
> Target end-state: server-authoritative deal + HMAC-SHA256 commit-reveal + client seed
> (industry standard, à la Stake/Shuffle). This document maps the current code, the exact
> deal a server must reproduce, the cheating vector, the refactor scope, and a phased plan.

---

## 0. Executive summary

- **The deck is 100% client-side today.** No server RPC, no Edge Function, and no `game_rooms`
  column ever deals, shuffles, stores, or validates cards. Shuffle is `Math.random()` Fisher-Yates
  in `utils/deck.ts`.
- **Multiplayer is host-authoritative peer-to-peer.** The **host client** shuffles and holds the
  **entire deck** — every player's hole cards *and* the face-down board cards — in local memory,
  then broadcasts each guest only their own slice over a Supabase Realtime channel (relay only).
  **A tampered host client is an unmitigated information-advantage cheat.** (Honest guests see only
  their own cards; the wire protocol does not leak — the leak is the host *process*.)
- **The economy has the same root gap.** `record_hand_net(p_device_id, p_net, p_hand_id)` **trusts a
  client-computed `p_net`**; the server never computes the result. The rake sink is already wired in
  that function but **dormant** (`app_config.hand_rake_pct` defaults to 0) — and even when switched
  on it rakes an *unverifiable* client number.
- **Conclusion: provably-fair and a working rake are the SAME refactor** — move the deal (and then
  the board evaluation + settle) onto a server the client cannot forge. Fairness is the front door;
  a trustworthy rake falls out of the same server authority.

---

## 1. Where the deck is shuffled/dealt today (client-side only — confirmed)

**Single source of truth: `utils/deck.ts`.** All deal paths route through it.

- `createDeck()` (`deck.ts:3-11`) — 52 cards in a fixed order: `SUITS × RANKS`
  (`constants/gameConfig.ts:73-74`): hearts(2→A), diamonds, clubs, spades. So unshuffled
  `index 0 = 2_hearts … index 51 = A_spades`. **This order is part of the reproducible spec.**
- `shuffleDeck()` (`deck.ts:13-20`) — **classic Fisher-Yates**, descending `i` from 51→1,
  `j = Math.floor(Math.random() * (i + 1))`, swap `i↔j`.
  - RNG = **`Math.random()`** — non-crypto, **unseeded, not reproducible**. No `crypto`, no seed in or out.
  - 100% client-side; nothing persisted or sent to a server.
- Solo deal call site: `app/game.tsx:515` → `initializeGameMulti(numberOfPlayers)` (`gameLogic.ts:187`)
  → `dealCardsMultiplayer()`.
- MP deal call site: `utils/realtimeMultiplayer.ts` `startGame()` → `dealNewHand()`
  (`gameLogic.ts:288`) → `dealCardsMultiplayer()`.

**Server check (DB):** no function matching `deal|shuffle|deck|card|seed|fair` exists. The only
game-adjacent server surface is room lifecycle (`cleanup_expired_rooms`, `finish_wedged_playing_rooms`,
`touch_room_player`, `game_rooms_lock_host_id`) and economy writers (`record_hand_net`,
`record_hand_result_d`, `submit_score`). All 12 Edge Functions are ops/bug/bot infra — **none touch
gameplay**. `game_rooms` columns: `id, room_code, host_id, host_name, status, player_count,
current_players, max_players, game_config, created_at, started_at, finished_at, expires_at, is_public,
club_id, table_kind` — **no `deck`/`seed` column.** ✅ No server deal path.

---

## 2. The multiboard deal sequence a server must reproduce byte-for-byte

`dealCardsMultiplayer(playerCount)` (`deck.ts:40-75`). Board count is dynamic (CAPS rule):

| Players | Boards | Cards/player | Hole total | Community total | Used | Discarded |
|---|---|---|---|---|---|---|
| 2P | 4 | 16 | 32 | 20 | 52 | 0 |
| 3P | 3 | 12 | 36 | 15 | 51 | 1 |
| 4P | 2 | 8  | 32 | 10 | 42 | 10 |

**Consumption order from the shuffled deck (`idx` starts at 0):**

1. **Phase A — all hole cards, seat-by-seat, contiguous blocks.** `P0 = deck[0 .. cpp-1]`,
   `P1 = deck[cpp .. 2*cpp-1]`, … (`deck.ts:48-51`). A player's whole hand (all boards' worth) is one
   contiguous slice; the per-board split of a player's 4 cards happens later in the UI, **not** here.
2. **Phase B — boards, board-by-board: 3 open then 2 closed (5 each).**
   `board_b.open = deck[idx..idx+2]; board_b.closed = deck[idx+3..idx+4]` (`deck.ts:54-58`).
3. **Phase C — discard the remainder** (`deck.ts:62`).

**Exact index layout (for a reference implementation / test vectors):**
- **2P:** P0=[0..15] P1=[16..31] · B0 open[32,33,34] closed[35,36] · B1[37..41] · B2[42..46] · B3[47..51].
- **3P:** P0=[0..11] P1=[12..23] P2=[24..35] · B0[36..40] B1[41..45] B2[46..50] · discard[51].
- **4P:** P0=[0..7] P1=[8..15] P2=[16..23] P3=[24..31] · B0[32..36] B1[37..41] · discard[42..51].

**Duplicate guard (`deck.ts:64-74`):** rebuilds all ids; if any duplicate, logs and **recurses**
(`return dealCardsMultiplayer(...)`). Mathematically never triggers, but a deterministic reproduction
must replicate the re-roll semantics (it would advance the RNG).

> The ONLY non-reproducible element is `Math.random()` at `deck.ts:16`. Replace it with a shared
> **seeded PRNG** driving the identical descending Fisher-Yates + the identical consume order, and the
> deal becomes deterministic and verifiable.

---

## 3. How the two MP clients agree on the deck (the cheating vector — confirmed)

**Host-authoritative, Supabase-Realtime-relayed.**

1. Host taps start → `app/lobby/table.tsx:160` `server.startGame(config)`.
2. `RealtimeServer.startGame()` (`realtimeMultiplayer.ts:554-596`) deals the **whole** hand locally
   via `dealNewHand()` → `dealCardsMultiplayer()` and stores it: `this.boards = boards`
   (`:564`), `this.playerHands = dealResult.playerHands` (`:565`, field declared `:170`).
3. Host reads its own hand with no network: `getDealtCards()` (`:608-609`).
4. Each guest is sent **only its slice**: `sendToPlayer(client.id, 'CARDS_DEALT', fullPayload)`
   (`:594`), where `fullPayload.yourCards = dealResult.playerHands[i]` (`:576`). Transport is a plain
   broadcast: `channel.send({ type:'broadcast', event:'game_message', payload:{…} })` (`:787-795`).
5. Guest receives at `case 'CARDS_DEALT'` → `onCardsDealt(...)` (~`:1087`), consumed in
   `app/results.tsx:641`.

**Cheating vector — CONFIRMED (host process, not the wire):**
- After the deal the host object holds `this.playerHands` (**every opponent's hole cards**) and
  `this.boards[].closedCards` (**all unrevealed board cards**) in plaintext, *before* it arranges its
  own 16 cards. A modified/instrumented host reads all of it → full information.
- The deck is `Math.random()` (`deck.ts:16`) — not committed, not server-verified.
- **Mitigation scope:** the `CardsDealtPayload` sends only `yourCards` + per-board `openCards` +
  `closedCardCount` (`constants/networkConfig.ts:73-79`); closed cards go out only at reveal via
  `BoardRevealPayload.closedCards` (`networkConfig.ts:91-93`, `realtimeMultiplayer.ts:695`). So a
  **passive honest guest** cannot see others' cards — the exposure is confined to **whoever controls
  the host process.**
- **No server is involved in the deal** — Supabase Realtime is a websocket relay only. No RPC, no
  Edge Function, no seed persisted.

---

## 4. Target architecture & the shared server-authority foundation

**Target:** the server (a Supabase **Edge Function**, the first gameplay EF) owns the deal:
`server_seed` (secret) + `client_seed` + `nonce` → deterministic shuffle → deal → returns each
player only their own cards, and (for closed board cards) withholds them until reveal. After the
hand, the server **reveals** `server_seed`; anyone can re-derive the exact deck and verify.

### 4.1 Provably-fair algorithm (HMAC-SHA256 commit-reveal → seeded Fisher-Yates)

1. **Commit (before deal):** server generates `server_seed` = 32 random bytes (CSPRNG). It publishes
   `commitment = SHA256(server_seed)` (hex) *before* any card is dealt, stored on the hand row.
2. **Client seed:** client supplies `client_seed` (default = a client-random string the user can
   override — the industry "set your own seed" UX). `nonce` = per-(server_seed) incrementing hand
   counter.
3. **Deterministic byte stream:** `HMAC_SHA256(key = server_seed, msg = "${client_seed}:${nonce}:${cursor}")`
   for `cursor = 0,1,2,…`, concatenated → an arbitrarily long uniform byte stream. Slice into 4-byte
   big-endian words → divide by 2^32 → uniform floats in `[0,1)`. (Reject-sample / extend the stream
   as the Fisher-Yates index range requires, to avoid modulo bias.)
4. **Shuffle:** run the **identical descending Fisher-Yates** from §1 over the `createDeck()` order
   from §1, drawing each `j` from the float stream instead of `Math.random()`.
5. **Deal:** consume in the **exact order from §2** (seat hole blocks → per-board open×3/closed×2 →
   discard). Return per-player `yourCards`; keep `closedCards` server-side until reveal.
6. **Reveal & verify:** after the hand, server returns `server_seed`. Client (and a public verifier)
   checks `SHA256(server_seed) == commitment`, re-derives the deck, and confirms it matches the cards
   played.

`fairness_rounds` table (new): `hand_id, room_code|null, server_seed_hash (commit), server_seed
(null until reveal), client_seed, nonce, player_count, deck_order_hash, created_at, revealed_at`.

### 4.2 Why this is the SAME refactor as rake/settle

Once the **server** deals, it *knows the full deck*. The same EF (or a sibling settle EF) can then:
- Port `evaluateAllBoards()` + `calculateChipDeltas()` (`utils/gameLogic.ts`) to compute the
  **authoritative** per-player net — instead of trusting the client's `p_net`.
- Apply the rake server-side on the *computed* winnings, and write the ledger via a hardened path
  (the existing `record_hand_net` already has the **cap + idempotency + rake sink**; it just needs
  its `p_net` replaced by a server-computed value, or to be called *by* the settle EF with a value
  the client can't forge).

So: **server-authoritative deal (fairness) ⇒ server-authoritative evaluation ⇒ trustworthy rake.**
One foundation, delivered front-to-back. The rake being "vestigial" (fired once, `hand_rake_pct=0`)
is downstream of this — activating it on today's client-trusted net would just tax a forgeable number.

> **CAPS-specific constraint:** the majority of users are **device-anonymous** (`auth.uid()` is NULL).
> The deal/settle EF therefore cannot rely on RLS ownership — it must authenticate by `device_id` and
> use the **cap + idempotency** discipline already established for anon chip-mutating RPCs
> (`record_hand_net`'s `ON CONFLICT (device_id, reference_id)` + ±10000 cap is the template).

---

## 5. Refactor scope — what changes, what breaks, how big

**New:**
- `deal` Edge Function (Deno/TS): port `createDeck` order + Fisher-Yates + `dealCardsMultiplayer`
  consume order, driven by a seeded HMAC PRNG; commit-reveal; writes `fairness_rounds`. Auth by
  `device_id`.
- `fairness_rounds` table + a settle/evaluate path (port `evaluateAllBoards`/`calculateChipDeltas`).
- A public **verifier** (re-derive deck from revealed seed) + an in-app "Fairness" UI (commitment
  before, reveal + verify after; client-seed editor).

**Changes / breaks:**
- **Solo (`app/game.tsx`):** the deal moves from `initializeGameMulti()` (local) to an EF call
  returning the player's cards + the commitment. The reveal timing (community/closed cards) must be
  fed from the server, not derived locally. *Medium blast radius* (the whole game-init path).
- **MP (`utils/realtimeMultiplayer.ts`):** the biggest change. The **host no longer deals** —
  `startGame()` calls the EF; the host receives only its own cards (loses the full-deck advantage,
  which *is the point*). The `CARDS_DEALT` / `BOARD_REVEAL` protocol shifts from "host broadcasts
  cards" to "each client fetches its own cards from the server; the server releases closed cards at
  reveal." Host/guest trust model inverts from host-authoritative to server-authoritative. *Large
  blast radius* (protocol + host lifecycle + reveal ordering).
- **Latency/offline:** dealing becomes a network round-trip. Solo currently works offline; a server
  deal needs an online path (or a signed-offline fallback that forfeits fairness — a product call).
- **Reveal choreography:** closed board cards must be withheld server-side and released on a
  server-authorized reveal, or the fairness guarantee leaks (a client mustn't hold closed cards early).

**Rough size:** the crypto/deal logic is **Small–Medium** (well-specified; §1–§2 give exact
reproduction). The **client refactor (solo + MP protocol + reveal ordering + offline story)** is
**Large**, and the MP protocol inversion is the riskiest single piece.

---

## 6. Migration order & effort (S / M / L / XL)

Phased so each step ships value and de-risks the next. **Nothing here is started.**

| Phase | Deliverable | Effort | Notes |
|---|---|---|---|
| **A. Server-authoritative deal** | `deal` EF reproduces §1–§2 with a **seeded** Fisher-Yates (seed can be server-only at first, no commit-reveal yet); solo + MP call it; MP host stops dealing. | **L** | The hard part. EF logic ≈ M; the **client/MP protocol refactor + reveal choreography + offline story** push it to L. Kills the host cheating vector on its own. Prereq for a real rake. |
| **B. HMAC commit-reveal + fairness table** | Add `server_seed` CSPRNG, `commitment = SHA256`, `nonce`, `fairness_rounds` table, reveal-after-hand, and expose commitment/reveal to the client. | **M** | Pure addition on top of A's EF. No client-UX required yet beyond storing/returning the fields. |
| **C. Client seed + verify UI** | User-settable `client_seed`, passed to the EF; in-app Fairness screen (commitment before, reveal + local re-derive after) + a public/standalone verifier. | **M** | UI-weighted. The re-derive verifier reuses A/B's exact algorithm; ship it as a tiny standalone page too (trust-building). |
| **(Follow-on) Server settle + live rake** | Port `evaluateAllBoards`/`calculateChipDeltas` into a settle EF; replace client `p_net` into `record_hand_net`; activate `hand_rake_pct`. | **M–L** | **Separate owner-gated batch** (touches every real chip; needs testers). Unlocked *for free* by A's server authority. See the economy-inflation item. |

**Recommended order:** A → B → C, then the owner-gated settle/rake follow-on. A is the keystone:
it removes the cheating vector and creates the server authority that B, C, and the rake all build on.

---

## 7. Risks, open questions, verification

- **MP protocol inversion (Phase A) is the top risk** — host lifecycle, reveal ordering, reconnect,
  and the existing `CARDS_DEALT`/`BOARD_REVEAL` dedup/ACK all change. **This is exactly the kind of MP
  change that has ONE acceptance test: two real physical devices** (per the standing Iron Rule — unit
  tests and single-device "it worked" are not verification here).
- **Offline solo:** decide whether solo must stay offline (then fairness is MP-only, or solo uses a
  signed-but-not-committed local deal) or becomes online-required.
- **Latency:** a per-hand EF round-trip on the deal; measure against the current instant local deal.
- **Modulo bias:** use rejection sampling / stream extension when mapping bytes → Fisher-Yates index,
  or the shuffle is subtly non-uniform (and "provably fair" but provably biased is worse than silent).
- **Anon auth:** the EF must gate on `device_id` (majority anon; `auth.uid()` NULL) with cap +
  idempotency — do not assume authenticated users.
- **Test vectors:** §2's exact index layouts give deterministic test vectors; pin them so the EF and
  the client verifier provably agree before any of this ships.

---

## Appendix — file/line index (as of 2026-07-25)

- `utils/deck.ts` — `createDeck` (3-11), `shuffleDeck` Fisher-Yates + `Math.random` (13-20),
  `dealCardsMultiplayer` (40-75: params 41-42, hole 48-51, boards 54-58, discard 62, dup guard 64-74).
- `constants/gameConfig.ts:73-74` — `SUITS` / `RANKS` order.
- `utils/gameLogic.ts` — `initializeGameMulti` (187), `dealNewHand` (288→292), `evaluateAllBoards` /
  `calculateChipDeltas` (settle logic to port).
- `app/game.tsx:515` — solo deal call site.
- `utils/realtimeMultiplayer.ts` — `RealtimeServer.startGame` (554-596), `playerHands` (170, 565),
  `getDealtCards` (608), `sendToPlayer('CARDS_DEALT')` (594), broadcast (787-795), `sendBoardReveal`
  (683-696), guest router `CARDS_DEALT` (~1087).
- `constants/networkConfig.ts` — `CardsDealtPayload` (73-79), `BoardRevealPayload.closedCards` (91-98).
- `app/lobby/table.tsx:160-162, 180, 212` — host start + instance.
- DB: `record_hand_net(text,integer,text)` — SECDEF, client `p_net`, ±10000 cap, `ON CONFLICT
  (device_id, reference_id)` idempotency, dormant rake sink via `app_config.hand_rake_pct`.
</content>
