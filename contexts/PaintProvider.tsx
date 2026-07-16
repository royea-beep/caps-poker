/**
 * contexts/PaintProvider.tsx — S75 (theme plumbing, ZERO visual change).
 *
 * Holds the ACTIVE paint for the app and exposes it via usePaint(). Paint = colour +
 * font-family ONLY. There is deliberately NO geometry here: sizes/spacing stay in
 * utils/responsive.ts, constants/theme.ts `spacing`, OBSIDIAN_GEOM and the existing
 * StyleSheets, exactly as today. A theme must never move or resize anything.
 *
 * S75 SCOPE: this provider is mounted but NO component reads usePaint() yet — S75
 * migrates 0 components and repaints 0 surfaces. The only theme is `current`, so the
 * app is pixel-identical. Later batches migrate surfaces' COLOUR/FONT reads to
 * render-time usePaint() (never geometry), which is what enables live repaint on
 * switch with no app reload.
 *
 * Gate: app_config.premium_theme_enabled. When false/absent we force `current`, so
 * the alternate themes stay dormant until the key is set server-side.
 */
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  currentPaint,
  getPaint,
  DEFAULT_PAINT_THEME,
  type PaintTokens,
  type PaintThemeId,
} from '../constants/paintThemes';
import { getSupabase } from '../utils/supabase';

/** AsyncStorage key holding the user's selected theme id. */
export const ACTIVE_THEME_KEY = 'caps.activeTheme';

interface PaintContextValue {
  /** The active paint tokens (colour + font-family only). */
  paint: PaintTokens;
  /** The active theme id. Always 'current' while the gate is off. */
  themeId: PaintThemeId;
  /** True once the persisted selection + remote gate have resolved. */
  ready: boolean;
  /** Whether alternate themes are unlocked (app_config.premium_theme_enabled). */
  premiumEnabled: boolean;
  /** Select a theme. No-ops to `current` while the gate is off. Persists the choice. */
  setThemeId: (id: PaintThemeId) => void;
}

const PaintContext = createContext<PaintContextValue>({
  paint: currentPaint,
  themeId: DEFAULT_PAINT_THEME,
  ready: false,
  premiumEnabled: false,
  setThemeId: () => {},
});

/** Read the remote gate. Never throws; defaults to false (alternates locked). */
async function fetchPremiumThemeEnabled(): Promise<boolean> {
  try {
    const sb = getSupabase();
    if (!sb) return false;
    const { data } = await sb
      .from('app_config')
      .select('value')
      .eq('key', 'premium_theme_enabled')
      .maybeSingle();
    // app_config.value is text/jsonb — treat only an explicit truthy as enabled.
    const v = (data as { value?: unknown } | null)?.value;
    return v === true || v === 'true';
  } catch {
    return false;
  }
}

export function PaintProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState<PaintThemeId>(DEFAULT_PAINT_THEME);
  const [premiumEnabled, setPremiumEnabled] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Resolve the persisted selection + the remote gate together, then apply once.
      const [stored, enabled] = await Promise.all([
        AsyncStorage.getItem(ACTIVE_THEME_KEY).catch(() => null),
        fetchPremiumThemeEnabled(),
      ]);
      if (cancelled) return;
      setPremiumEnabled(enabled);
      // Gate closed → force `current` regardless of what was persisted.
      const next = enabled ? ((stored as PaintThemeId | null) ?? DEFAULT_PAINT_THEME) : DEFAULT_PAINT_THEME;
      setThemeIdState(next);
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const setThemeId = useCallback((id: PaintThemeId) => {
    // While the gate is off the only selectable theme is `current`.
    const next: PaintThemeId = premiumEnabled ? id : DEFAULT_PAINT_THEME;
    setThemeIdState(next);
    void AsyncStorage.setItem(ACTIVE_THEME_KEY, next).catch(() => {});
  }, [premiumEnabled]);

  const value = useMemo<PaintContextValue>(() => ({
    paint: getPaint(themeId),
    themeId,
    ready,
    premiumEnabled,
    setThemeId,
  }), [themeId, ready, premiumEnabled, setThemeId]);

  return <PaintContext.Provider value={value}>{children}</PaintContext.Provider>;
}

/**
 * Read the active paint. Colour + font-family ONLY — never geometry.
 * Not consumed by any component in S75 (see file header).
 */
export function usePaint(): PaintContextValue {
  return useContext(PaintContext);
}
