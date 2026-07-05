/**
 * PRACTICE-TO-LIVE — the countdown banner + jump navigation, shared by the practice
 * game screen (mid-hand) and the results screen (between hands). It subscribes to the
 * practiceLiveSession coordinator, renders the synced 30s countdown when a real opponent
 * joins, and performs the router navigation into /multiplayer-game on the 'jump' event.
 *
 * The 30s deadline is the HOST's single clock (broadcast to the guest), so both peers show
 * the same number — no client-side clock negotiation. We render ceil((deadline-now)/1000).
 *
 * `jumpImmediately` (results screen): if a countdown is already running / arrives while the
 * player sits between hands, jump right away — the 30s only exists to let an in-progress bot
 * hand finish (edge e).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import {
  subscribePracticeLive,
  getPracticeLiveState,
  requestPracticeLiveJumpNow,
  markPracticeLiveLaunched,
} from '../utils/practiceLiveSession';
import { rf, rs } from '../utils/responsive';

interface Props {
  /** Results screen passes true: no bot hand is in flight, so jump the moment a countdown starts. */
  jumpImmediately?: boolean;
}

export default function PracticeLiveOverlay({ jumpImmediately }: Props) {
  const router = useRouter();
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const handleCountdown = (dl: number) => {
      setDeadline(dl);
      if (jumpImmediately) requestPracticeLiveJumpNow();
    };

    const unsub = subscribePracticeLive((e) => {
      if (e.kind === 'countdown') {
        handleCountdown(e.deadline);
      } else if (e.kind === 'cancelled' || e.kind === 'ended') {
        setDeadline(null);
      } else if (e.kind === 'jump') {
        markPracticeLiveLaunched();
        router.replace({ pathname: '/multiplayer-game', params: e.params } as any);
      }
    });

    // Hydrate: a countdown may already be running when this screen mounts (e.g. we just
    // navigated game → results while the clock was ticking).
    const st = getPracticeLiveState();
    if (st.phase === 'countdown' && st.deadline) handleCountdown(st.deadline);

    return unsub;
  }, [jumpImmediately, router]);

  // Tick only while a countdown is active.
  useEffect(() => {
    if (deadline == null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadline]);

  if (deadline == null) return null;
  const secs = Math.max(0, Math.ceil((deadline - now) / 1000));

  return (
    <View style={styles.wrap} pointerEvents="none" accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text style={styles.text} numberOfLines={1} adjustsFontSizeToFit>
        👤 A player joined — going LIVE in {secs}s
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: rs(52),
    alignSelf: 'center',
    zIndex: 60,
    backgroundColor: '#1E7D46',
    borderRadius: rs(999),
    paddingHorizontal: rs(16),
    paddingVertical: rs(8),
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: rs(8),
    shadowOffset: { width: 0, height: rs(2) },
    elevation: 6,
  },
  text: {
    color: '#EAFBEF',
    fontSize: rf(14),
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
