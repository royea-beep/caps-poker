// SERVER-DEAL-PHASE-A — the next-hand unanimity decision, extracted PURE so it is unit-testable
// (mirrors request_next_hand / begin_next_hand in 20260726092000_promote_and_rls_lockdown.sql).
//
// H1: acking by `user_id` DEADLOCKS the table. room_players.user_id is NULLABLE and
// join_requires_session defaults FALSE, so a legacy seat can have user_id = NULL; an ack array can
// never contain SQL NULL, so unanimity becomes unreachable FOREVER after one hand — with no reaper
// coverage (status='playing' + live players => finish_wedged_playing_rooms never fires).
// The seat PK (room_players.id, NOT NULL for every seat) is the ack token instead.

export interface SeatRow {
  id: string;              // room_players.id — PK, NOT NULL, the ack token
  userId: string | null;   // room_players.user_id — NULLABLE (the trap)
  lastSeenMs: number;      // room_players.last_seen
}

export const ACK_STALE_MS = 45_000; // < the 90s evict_ghost_seats sweep

/** Seats that count toward unanimity: live ones only (a dropped player must not hold the table). */
export function liveSeats(seats: SeatRow[], nowMs: number, staleMs: number = ACK_STALE_MS): SeatRow[] {
  return seats.filter((s) => s.lastSeenMs > nowMs - staleMs);
}

/** CORRECT rule: ack by seat PK — every seat is ackable regardless of uid. */
export function isUnanimousBySeatId(seats: SeatRow[], acks: string[], nowMs: number, staleMs: number = ACK_STALE_MS): boolean {
  const live = liveSeats(seats, nowMs, staleMs);
  if (live.length === 0) return false;
  return live.every((s) => acks.includes(s.id));
}

/** BROKEN rule kept for the regression test: ack by uid — a NULL-uid seat can never be acked. */
export function isUnanimousByUid(seats: SeatRow[], acks: (string | null)[], nowMs: number, staleMs: number = ACK_STALE_MS): boolean {
  const live = liveSeats(seats, nowMs, staleMs);
  if (live.length === 0) return false;
  return live.every((s) => s.userId !== null && acks.includes(s.userId));
}
