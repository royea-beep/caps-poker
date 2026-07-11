import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWaitingSeatStore } from '../stores/waitingSeatStore';
import { touchRoomPlayer, leaveTable } from '../utils/lobbyApi';
import { rf, rs, rv } from '../utils/responsive';

/**
 * S69 — App-wide waiting-seat banner + heartbeat.
 *
 * Mounted once in the root layout. While a seat is held (useWaitingSeatStore) it:
 *   - heartbeats touch_room_player every HEARTBEAT_MS so the DB seat never goes stale
 *     (evict_ghost_seats(90) runs each minute; 25s keeps ~3 beats of headroom), and
 *     keeps beating no matter which screen the user navigates to;
 *   - shows a "Waiting at #CODE · Return / Leave" banner on every screen EXCEPT the
 *     table screen itself (where the full waiting UI is already visible).
 *
 * Return re-opens the table screen; Leave frees the seat immediately (leave_table) and
 * stops the heartbeat. On app close/background there is no client action — the reaper
 * frees the seat ~90s after the heartbeat stops.
 */
const HEARTBEAT_MS = 25_000; // < the 90s reaper window (evict_ghost_seats(90))

export default function WaitingSeatBanner() {
  const heldSeat = useWaitingSeatStore((s) => s.heldSeat);
  const releaseSeat = useWaitingSeatStore((s) => s.releaseSeat);
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // App-wide heartbeat — runs whenever a seat is held, regardless of the current screen.
  useEffect(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (!heldSeat) return;
    const { roomCode, deviceId, userId } = heldSeat;
    void touchRoomPlayer(roomCode, deviceId, userId); // prime immediately
    timerRef.current = setInterval(() => {
      void touchRoomPlayer(roomCode, deviceId, userId);
    }, HEARTBEAT_MS);
    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  }, [heldSeat]);

  const handleReturn = useCallback(() => {
    if (!heldSeat) return;
    router.push({
      pathname: '/lobby/table',
      params: {
        roomCode: heldSeat.roomCode,
        playerCount: String(heldSeat.maxPlayers),
        isHost: heldSeat.isHost ? 'true' : 'false',
        ...(heldSeat.clubCode ? { clubCode: heldSeat.clubCode } : {}),
      },
    } as any);
  }, [heldSeat, router]);

  const handleLeave = useCallback(async () => {
    if (!heldSeat) return;
    const { roomCode, deviceId, userId } = heldSeat;
    releaseSeat(); // stop the heartbeat + hide the banner immediately
    try { await leaveTable(roomCode, userId, deviceId); } catch { /* seat reaped anyway */ }
  }, [heldSeat, releaseSeat]);

  if (!heldSeat) return null;
  // Already on the table screen — the full waiting UI is showing; no banner needed.
  if (pathname && pathname.startsWith('/lobby/table')) return null;

  return (
    <View style={[styles.wrap, { top: insets.top + rs(6) }]} pointerEvents="box-none">
      <View style={styles.banner}>
        <Text style={styles.text} numberOfLines={1}>
          ⏳ Waiting at #{heldSeat.roomCode}
        </Text>
        <View style={styles.actions}>
          <Pressable
            onPress={handleReturn}
            style={styles.returnBtn}
            accessibilityRole="button"
            accessibilityLabel={`Return to your table ${heldSeat.roomCode}`}
          >
            <Text style={styles.returnText}>Return</Text>
          </Pressable>
          <Pressable
            onPress={handleLeave}
            style={styles.leaveBtn}
            accessibilityRole="button"
            accessibilityLabel="Leave your table"
          >
            <Text style={styles.leaveText}>Leave</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: rs(10),
    right: rs(10),
    zIndex: 1000,
    elevation: 1000,
    alignItems: 'center',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 430,
    backgroundColor: '#2A0E0E',
    borderWidth: 1.5,
    borderColor: '#c9a84c',
    borderRadius: rv(12),
    paddingVertical: rs(8),
    paddingHorizontal: rs(12),
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  text: {
    flex: 1,
    color: '#F5E7C8',
    fontWeight: '800',
    fontSize: rf(13, 11),
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(8),
  },
  returnBtn: {
    backgroundColor: '#c9a84c',
    borderRadius: rv(8),
    paddingVertical: rs(6),
    paddingHorizontal: rs(12),
    minHeight: 32,
    justifyContent: 'center',
  },
  returnText: {
    color: '#2A0E0E',
    fontWeight: '900',
    fontSize: rf(12, 10),
  },
  leaveBtn: {
    borderWidth: 1,
    borderColor: 'rgba(245,231,200,0.5)',
    borderRadius: rv(8),
    paddingVertical: rs(6),
    paddingHorizontal: rs(12),
    minHeight: 32,
    justifyContent: 'center',
  },
  leaveText: {
    color: '#F5E7C8',
    fontWeight: '700',
    fontSize: rf(12, 10),
  },
});
