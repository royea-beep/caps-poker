import { useEffect, useState } from 'react';
import { fetchPokerShop } from './supabaseEconomy';
import { getDeviceId } from './leaderboard';

/**
 * OWNERSHIP — the one place the client asks "what does this device own".
 *
 * The card back sprint read the owned set inline inside its picker. Three more families need the
 * same answer, so it lives here once rather than four times. The source is get_poker_shop — the
 * call the shop already makes on every load — so no new RPC and no new round trip shape.
 *
 * Two rules every cosmetic family follows, and they are why a purchase can never strand anyone:
 *   1. A picker HIDES until there is an actual choice. One option is not a choice.
 *   2. A selection must never outlive its entitlement — if the persisted choice is no longer
 *      owned, fall back to the free default rather than render something unowned.
 * `useOwnedSkus` returns `ready` so a caller can tell "not loaded yet" from "owns nothing", which
 * matters: falling back on an empty set that simply has not arrived would reset a real selection.
 */
export interface OwnedSkus {
  skus: string[];
  ready: boolean;
}

export function useOwnedSkus(): OwnedSkus {
  const [state, setState] = useState<OwnedSkus>({ skus: [], ready: false });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const shop = await fetchPokerShop(await getDeviceId());
        if (!alive) return;
        const skus = (shop?.items ?? []).filter((i) => i.owned).map((i) => i.event_type);
        setState({ skus, ready: true });
      } catch {
        // Offline: stay `ready: false` on purpose. Free defaults still work, and a selection the
        // player legitimately owns is NOT reset just because the network was unavailable.
        if (alive) setState({ skus: [], ready: false });
      }
    })();
    return () => { alive = false; };
  }, []);

  return state;
}

/** A variant with `sku === null` is free to everyone; anything else needs the entitlement. */
export function isUnlocked(sku: string | null, ownedSkus: readonly string[]): boolean {
  return sku === null || ownedSkus.includes(sku);
}
