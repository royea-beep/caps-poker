/**
 * Sit & Go — PHASE 1 of VAMOS-CAPS-GAME-MODES-OVERHAUL (feat/play-overhaul).
 *
 * The bespoke Sit&Go in-game render (its own entry/lobby/playing screen with a
 * separate <Board> layout) is RETIRED. Per owner decision, all game modes now use
 * the ONE working game screen (app/game.tsx) so play looks identical everywhere.
 *
 * This route is now a thin redirect: it sets the table size (4 players — the
 * largest table) and replaces into /game, which renders via the shared
 * <BoardArrangement>/<BoardReveal> path. Phase 3 removes the Sit&Go entry from the
 * Play surface entirely; until then, tapping it lands on the unified screen.
 */
import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useGameStore } from '../store/gameStore';

export default function SitAndGoRedirect() {
  const router = useRouter();
  const updateConfig = useGameStore((s) => s.updateConfig);

  useEffect(() => {
    updateConfig({ numberOfPlayers: 4 });
    router.replace('/game' as any);
  }, [router, updateConfig]);

  return (
    <View style={styles.root}>
      <ActivityIndicator size="large" color="#4FD6A8" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#161922', alignItems: 'center', justifyContent: 'center' },
});
