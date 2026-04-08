/**
 * useGameColors — returns win/lose color palette based on colorblind mode.
 * S102: colorblind-safe blue/orange replaces green/red.
 */
import { useGameStore } from '../store/gameStore';
import { DEFAULT_WIN_LOSE, COLORBLIND_WIN_LOSE, WinLosePalette } from '../constants/theme';

export function useGameColors(): WinLosePalette {
  const colorblindMode = useGameStore((s) => s.colorblindMode);
  return colorblindMode ? COLORBLIND_WIN_LOSE : DEFAULT_WIN_LOSE;
}
