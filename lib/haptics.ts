// Unified haptic feedback helpers
// Uses expo-haptics which is already installed
// Centralizes all haptic patterns for consistent UX
//
// Usage:
//   import { tapCard, placeCard, winSweep } from "@/lib/haptics";
//   placeCard();

import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

// Helper: safe trigger (no-op on web/unsupported)
async function safe(fn: () => Promise<void>) {
  if (Platform.OS === "web") return;
  try { await fn(); } catch {}
}

/** Light tap when selecting a card */
export const tapCard = () => safe(() => Haptics.selectionAsync());

/** Medium thud when placing a card on a board */
export const placeCard = () => 
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));

/** Strong thud when committing arrangement (אישור pressed) */
export const commitArrangement = () => 
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));

/** Soft tick when timer beep should play (10s, 3s warnings) */
export const timerWarning = () => 
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

/** Card flip — light flutter as each card reveals */
export const cardFlip = () => 
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

/** Win on a single board — medium notification */
export const winBoard = () => 
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));

/** Lose a board — error notification */
export const loseBoard = () => 
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));

/** Win 4/4 boards (sweep) — drum roll then big success */
export const winSweep = async () => {
  if (Platform.OS === "web") return;
  try {
    for (let i = 0; i < 3; i++) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await new Promise((r) => setTimeout(r, 80));
    }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {}
};

/** Drum roll before reveal phase starts */
export const drumRoll = async () => {
  if (Platform.OS === "web") return;
  try {
    for (let i = 0; i < 5; i++) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await new Promise((r) => setTimeout(r, 60));
    }
  } catch {}
};

/** Button press — universal */
export const buttonPress = () => 
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

/** Achievement unlocked or coin/cup earned */
export const achievement = () => 
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));

/** Error or invalid action */
export const errorTap = () => 
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
