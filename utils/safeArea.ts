/**
 * safeArea.ts — S120
 * Unified safe area helpers for Dynamic Island (iPhone 16/17) support.
 */
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { rs } from './responsive';

/**
 * Returns safe padding values for all sides.
 * bottom is clamped to rs(16) minimum for home indicator clearance.
 */
export function useSafePadding() {
  const insets = useSafeAreaInsets();
  return {
    top:    insets.top,
    bottom: Math.max(insets.bottom, rs(16)),
    left:   Math.max(insets.left, 0),
    right:  Math.max(insets.right, 0),
  };
}

/**
 * Standard screen layout styles.
 * Handles Dynamic Island (iPhone 16/17) and Home Indicator on all screens.
 */
export function useScreenStyle() {
  const safe = useSafePadding();
  return {
    container: {
      flex: 1,
    },
    header: {
      paddingTop: safe.top,
    },
    scrollContent: {
      paddingBottom: safe.bottom + rs(20),
    },
    stickyBottom: {
      paddingBottom: safe.bottom || rs(16),
    },
  };
}
