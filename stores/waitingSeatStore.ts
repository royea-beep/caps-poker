import { create } from 'zustand';

/**
 * S69 — App-wide "waiting seat" state.
 *
 * Holding a waiting seat is a cross-screen concern: the player keeps their DB seat
 * (room_players) alive by heartbeating touch_room_player while a seat is held, even
 * after navigating away from the table screen. This store is the single source of
 * truth; WaitingSeatBanner (mounted in the root layout) owns the heartbeat + the
 * "Waiting at #CODE · Return / Leave" banner.
 *
 * Deliberately NOT persisted: if the app is closed, the running evict_ghost_seats(90)
 * cron frees the seat ~90s after the heartbeat stops, so on relaunch we must NOT claim
 * to still hold a seat that has been reaped.
 */
export interface HeldSeat {
  roomCode: string;
  deviceId: string;
  userId: string | null;
  maxPlayers: number;
  isHost: boolean;
  clubCode: string | null;
}

interface WaitingSeatState {
  heldSeat: HeldSeat | null;
  holdSeat: (seat: HeldSeat) => void;
  releaseSeat: () => void;
}

export const useWaitingSeatStore = create<WaitingSeatState>((set) => ({
  heldSeat: null,
  holdSeat: (seat) => set({ heldSeat: seat }),
  releaseSeat: () => set({ heldSeat: null }),
}));
