/**
 * Per-player private delivery for hole cards.
 *
 * PROVEN LEAK (2026-07-31 N2, re-confirmed in code 2026-08-13): `sendToPlayer` in
 * realtimeMultiplayer.ts publishes to the SHARED room channel with a `targetId` field, and the
 * guest filters on it client-side (`:932`). Its own doc comment says so: "Send to a specific
 * player (broadcast with targetId field)". Any subscriber to `caps-room-{code}` — the anon key
 * ships in the public web bundle, and room codes are 4 characters — receives every seat's
 * `yourCards` and simply ignores the filter.
 *
 * Only two message types carry private data: CARDS_DEALT (`yourCards`) and
 * GAME_STATE_SNAPSHOT (`yourCards`). BOARD_REVEAL and HAND_COMPLETE are showdown data and stay
 * on the shared channel untouched.
 *
 * TWO HALVES, ONE MERGE — read this before shipping:
 *
 *   A separate topic per player is NOT a security control on its own. Per docs/PHASE_0_CHANNEL_AUTHZ.md
 *   (P1), Supabase public and private broadcasts are SEPARATE DELIVERY DOMAINS — a public message
 *   never reaches a private channel and vice versa — and authorisation only exists once the channel
 *   is `private: true` AND a `realtime.messages` policy gates the topic. Without the policy, a
 *   per-player topic is obscurity: the topic name embeds the device id, which is not a secret.
 *
 *   So channel authz must be ENFORCED (app_config.phase0_channel_authz_enforced) in the SAME merge that applies
 *   supabase/migrations/*_phase0_channel_authz.sql. Flip it without the policy and every guest
 *   fails to subscribe and receives no cards — worse than the leak. Apply the policy without
 *   flipping it and the shared channel stays readable. Neither half is shippable alone.
 */

import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from './supabase';

/**
 * RUNTIME FLAG — `app_config.phase0_channel_authz_enforced`. Follows utils/iapEnabled.ts.
 *
 * WHY THIS IS NOT A `const`. It was one until 2026-08-13. A compile-time constant is
 * constant-folded by Metro, so reverting it is a code change -> rebuild -> redeploy. On web that
 * is ~6 minutes through CI. On native it is a whole new TestFlight build, because OTA is dead
 * (the Expo account is disabled) — and TestFlight is the one thing we get a single shot at. A
 * security switch whose only native revert is an App Store round trip is not a switch.
 *
 * FAIL-SAFE DIRECTION: DEFAULTS TO **ENFORCED** (true). This is the opposite of iapEnabled,
 * which defaults to hidden, and the reasoning is worth stating because it looks backwards:
 *
 *   - Default OPEN on a failed config read => the client silently returns to publishing hole
 *     cards on the shared room channel. The leak reopens, nothing looks wrong, and nobody finds
 *     out. A silent security regression is unrecoverable — you cannot fix what you cannot see.
 *   - Default ENFORCED on a failed config read => at worst players cannot subscribe and report
 *     "I got no cards" within one hand. Loud, immediate, and fixable in minutes.
 *
 * A visible outage is recoverable; a silent leak is not. Security flags fail closed.
 *
 * It is also the common case: the realtime.messages policy is already live on production, so
 * enforced IS the correct steady state. The default is not a compromise, it is the norm.
 *
 * To revert without any deploy:
 *   UPDATE app_config SET value = 'false' WHERE key = 'phase0_channel_authz_enforced';
 * Clients pick it up on their next room join. Do that ONLY together with dropping the policy —
 * see the migration header; the two halves revert together exactly as they shipped together.
 */
let _enforced = true;
let _loading: Promise<void> | null = null;

/** Synchronous cached read. Defaults to true (enforced) until told otherwise. */
export function isChannelAuthzEnforced(): boolean {
  return _enforced;
}

/** Fetch once per app run, memoised. Never throws, never flips to open on failure. */
export function ensureChannelAuthzLoaded(): Promise<void> {
  if (_loading) return _loading;
  _loading = (async () => {
    try {
      const sb = getSupabase();
      if (!sb) return;
      const { data } = await sb
        .from('app_config')
        .select('value')
        .eq('key', 'phase0_channel_authz_enforced')
        .maybeSingle();
      const v = data?.value;
      // Only an EXPLICIT false disables. Absent key, null, or a failed read all stay enforced.
      if (v === false || v === 'false') _enforced = false;
    } catch {
      /* stay enforced — see FAIL-SAFE DIRECTION above */
    }
  })();
  return _loading;
}

/** The two message types that carry a single player's hole cards. Nothing else belongs here. */
export const PRIVATE_MESSAGE_TYPES: ReadonlySet<string> = new Set([
  'CARDS_DEALT',
  'GAME_STATE_SNAPSHOT',
]);

export function privateTopic(roomCode: string, playerId: string): string {
  return `caps-room-${roomCode}-p-${playerId}`;
}

function channelConfig() {
  return isChannelAuthzEnforced() ? { config: { private: true } } : undefined;
}

/**
 * Host side: one lazily-created channel per seated player.
 *
 * Supabase's limit is 100 channels per client connection and 500 concurrent joins/second
 * (Realtime quotas). CAPS caps a table at 4 players, so the worst case is the shared room
 * channel + 3 guest channels + the optional spectator channel = 5. Three orders of magnitude
 * of headroom; the limit is not a design constraint here.
 */
export class PrivateChannelHub {
  private channels = new Map<string, RealtimeChannel>();
  private roomCode = '';

  setRoom(roomCode: string): void {
    this.roomCode = roomCode;
  }

  /**
   * Returns a SUBSCRIBED channel, or null if it could not be established.
   *
   * Callers must treat null as "this player did not get their cards" and fall back, rather than
   * assume delivery. A player who silently never receives a hand is a worse failure than the
   * leak this whole change exists to close.
   */
  async ensure(playerId: string): Promise<RealtimeChannel | null> {
    const existing = this.channels.get(playerId);
    if (existing) return existing;

    const supabase = getSupabase();
    if (!supabase || !this.roomCode) return null;

    // Resolve the runtime flag before the FIRST channel is built, not after — a channel created
    // with the wrong privacy setting lands in the wrong delivery domain and cannot be repaired
    // without tearing it down. Memoised, so this costs one query per app run.
    await ensureChannelAuthzLoaded();

    const ch = supabase.channel(privateTopic(this.roomCode, playerId), channelConfig());
    const ok = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 8000);
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          resolve(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timeout);
          resolve(false);
        }
      });
    });

    if (!ok) {
      try {
        await ch.unsubscribe();
      } catch {
        /* nothing to clean */
      }
      return null;
    }

    this.channels.set(playerId, ch);
    return ch;
  }

  /** True if the payload was handed to a subscribed private channel. */
  async send(playerId: string, type: string, payload: unknown, senderId: string): Promise<boolean> {
    const ch = await this.ensure(playerId);
    if (!ch) return false;
    await ch.send({
      type: 'broadcast',
      event: 'game_message',
      payload: { type, data: payload, senderId, targetId: playerId },
    });
    return true;
  }

  drop(playerId: string): void {
    const ch = this.channels.get(playerId);
    if (!ch) return;
    this.channels.delete(playerId);
    try {
      void ch.unsubscribe();
    } catch {
      /* already gone */
    }
  }

  teardown(): void {
    for (const id of [...this.channels.keys()]) this.drop(id);
    this.roomCode = '';
  }
}
