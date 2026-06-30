import { useEffect, useState } from 'react';
import { getSupabase } from '../utils/supabase';
import { getDeviceId } from '../utils/leaderboard';

/**
 * Live "players online" count for the lobby via Supabase Realtime presence (the same
 * presence mechanism the in-game rooms already use). Every lobby viewer joins a shared
 * channel keyed by their device id, so the count reflects REAL humans currently on the
 * lobby right now — never a faked number. It is always ≥1 once synced (you count too),
 * which is exactly what keeps a joining tester from seeing a 0/N graveyard.
 *
 * Returns 0 until the channel first syncs. No DB writes; the subscription is torn down on
 * unmount. Keyed by device id so multiple tabs on one device collapse to a single presence.
 */
export function useLobbyPresence(): number {
  const [online, setOnline] = useState(0);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let channel: ReturnType<typeof sb.channel> | null = null;
    let cancelled = false;

    (async () => {
      const deviceId = (await getDeviceId().catch(() => null)) || `anon-${Math.floor(Math.random() * 1e9)}`;
      if (cancelled) return;
      channel = sb.channel('caps:lobby', { config: { presence: { key: deviceId } } });
      channel.on('presence', { event: 'sync' }, () => {
        if (!channel) return;
        // One entry per presence key (= per device) → a real headcount of lobby viewers.
        setOnline(Object.keys(channel.presenceState()).length);
      });
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') void channel?.track({ at: Date.now() });
      });
    })();

    return () => {
      cancelled = true;
      if (channel) {
        try { sb.removeChannel(channel); } catch { /* best-effort teardown */ }
        channel = null;
      }
    };
  }, []);

  return online;
}
