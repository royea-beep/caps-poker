/**
 * BackControl — one way out, and it always works.
 *
 * MEASURED 2026-08-13 (both engines, live deploy). Six secondary routes were probed by
 * navigating to them DIRECTLY, which is what a reloaded tab or a shared link does:
 *
 *   /shop /replay /heatmap /spectate  — a back control exists, cursor:pointer, and firing a
 *                                        full pointer+mouse+click sequence on it did NOTHING.
 *   /battle-pass /coaching            — no back control exists at all.
 *
 * The first four are not dead buttons. Entered in-app (home -> "Open chip shop" -> back) they
 * navigate correctly on Chromium AND WebKit. They are bare `router.back()` calls, and on a
 * cold entry the history stack is empty, so back has nowhere to go and silently no-ops. On web
 * the browser chrome still offers an escape; on iOS there is none, and the tester is stranded
 * with no way out but force-quitting the app.
 *
 * `5bdf384` (2026-08-12) fixed exactly this for /results and did not generalise. This does.
 *
 * The guard is the idiom already used at app/multiplayer-game.tsx:1191 — canGoBack() ?? home —
 * lifted here so there is ONE copy instead of eight.
 *
 * Iron Rule #3: every size derives from the live window width via rs()/rf(). Nothing here is a
 * literal pixel, and screenW comes from useWindowDimensions rather than module scope, because
 * rs()/rf() freeze at import time on web and would bake in whatever width loaded first.
 */

import React from 'react';
import { Pressable, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { rf, rs } from '../utils/responsive';
import { t, isRTL, getLanguage } from '../utils/i18n';

/**
 * Navigate back if there is anywhere to go back to, otherwise go home.
 *
 * Deliberately a PLAIN function, not only a hook: the eight screens that need it pass their
 * back handler straight to `onPress`, and a hook cannot be called from inside JSX. Expo
 * Router's `router` singleton is imperative and exposes canGoBack(), so no hook is required.
 */
export function safeBack(): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/');
  }
}

/**
 * Hook form, for screens that need a stable identity in a dependency array — or that must do
 * cleanup first (finishing a table, clearing a timer) and compose around it, exactly as
 * multiplayer-game does before leaving.
 */
export function useSafeBack(): () => void {
  return React.useCallback(safeBack, []);
}

interface Props {
  /** Visible label. Defaults to the glyph-only form used by the existing headers. */
  label?: string;
  /** Runs before navigating — cleanup, telemetry. Navigation happens regardless. */
  onBeforeBack?: () => void;
  tint?: string;
}

/** Minimum comfortable touch target. The a11y sweeps of 2026-08-10/11 settled on 44. */
const MIN_TARGET = 44;

export function BackControl({ label, onBeforeBack, tint = '#E8B563' }: Props) {
  // FULL-I18N 2026-09-03 — the default was the literal '‹  Back'. The chevron follows reading
  // direction; the word comes from the table. An explicit `label` prop still wins.
  const resolved = label ?? `${isRTL() ? '›' : '‹'}  ${t().back}`;
  const { width: screenW } = useWindowDimensions();
  const safeBack = useSafeBack();

  const handle = React.useCallback(() => {
    try {
      onBeforeBack?.();
    } catch {
      /* cleanup must never block the only way out */
    }
    safeBack();
  }, [onBeforeBack, safeBack]);

  return (
    <Pressable
      testID="back-control"
      accessibilityRole="button"
      accessibilityLabel={t().back}
      accessibilityLanguage={getLanguage() === 'he' ? 'he' : undefined}
      onPress={handle}
      hitSlop={12}
      style={[
        styles.btn,
        { minWidth: rs(MIN_TARGET, screenW), minHeight: rs(MIN_TARGET, screenW), paddingHorizontal: rs(8, screenW) },
      ]}
    >
      <Text style={[styles.txt, { color: tint, fontSize: rf(17, undefined, undefined, screenW) }]}>{resolved}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { justifyContent: 'center', alignSelf: 'flex-start' },
  txt: { fontWeight: '700' },
});

export default BackControl;
