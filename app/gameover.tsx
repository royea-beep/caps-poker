import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { rf, rs } from '../utils/responsive';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import ChipsDisplay from '../components/ChipsDisplay';
import { Button } from '../components/Button';
import { useGameStore } from '../store/gameStore';
import { COLORS } from '../constants/gameConfig';
import { fetchPokerShop } from '../utils/supabaseEconomy';
import { getDeviceId } from '../utils/leaderboard';

export default function GameOverScreen() {
  const router = useRouter();
  const chips = useGameStore((s) => s.chips);
  const setChips = useGameStore((s) => s.setChips);

  const [confirming, setConfirming] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Shake animation on mount
  const shakeX = useSharedValue(0);

  useEffect(() => {
    shakeX.value = withSequence(
      withTiming(-8, { duration: 60 }),
      withTiming(8, { duration: 60 }),
      withTiming(-6, { duration: 60 }),
      withTiming(6, { duration: 60 }),
      withTiming(-3, { duration: 60 }),
      withTiming(3, { duration: 60 }),
      withTiming(0, { duration: 60 }),
    );
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const handlePlayAgain = () => {
    if (!confirming) {
      setConfirming(true);
      timerRef.current = setTimeout(() => {
        setConfirming(false);
      }, 3000);
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      // UNLEDGERED-GRANT FIX 2026-08-13. This was `setChips(config.startingChips)` — a purely
      // local write of a full 2,000-chip stack, with no server call and no ledger row, every
      // time a busted player tapped again. Two things were wrong with it:
      //
      //   1. It invented chips the server never issued. Home re-adopts the server balance on
      //      mount (app/(tabs)/index.tsx — fetchPokerShop -> setChips), so the player watched
      //      a fresh stack appear here and silently evaporate the moment they went home.
      //   2. The designed rescue is claim_emergency_chips: 200 chips, once per day, capped and
      //      written to chip_transactions. This path handed out 2,000, unledgered and unlimited.
      //
      // The server is the authority, so ask it rather than guess. We do NOT call
      // claim_emergency_chips here: it takes a uuid leaderboard id, and the majority of CAPS
      // players are device-anonymous with auth.uid() NULL, so the device->uuid mapping has to
      // be settled before that RPC can be wired in honestly. Adopting the real balance is
      // strictly better than fabricating one, and it is the whole of the data-integrity bug.
      void (async () => {
        try {
          const deviceId = await getDeviceId();
          const shop = await fetchPokerShop(deviceId);
          if (shop && typeof shop.balance === 'number') setChips(shop.balance);
        } catch {
          /* offline — fall through on the balance we already hold; nothing is invented */
        } finally {
          router.replace('/game');
        }
      })();
    }
  };

  const handleHome = () => {
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.View entering={FadeIn.duration(600)} style={styles.header}>
          <Animated.Text accessibilityRole="header" accessibilityLiveRegion="polite" style={[styles.title, shakeStyle]}>GAME OVER</Animated.Text>
          <Text style={styles.subtitle}>Not enough chips to continue</Text>
        </Animated.View>

        <Animated.View entering={FadeIn.duration(400).delay(400)}>
          <ChipsDisplay amount={chips} label="Final Balance" size="large" />
        </Animated.View>

        <Animated.View
          style={styles.buttons}
          entering={FadeIn.duration(400).delay(800)}
        >
          <Button
            title={confirming ? 'ARE YOU SURE?' : 'PLAY AGAIN'}
            variant={confirming ? 'secondary' : 'gold'}
            onPress={handlePlayAgain}
            accessibilityState={{ busy: confirming }}
            accessibilityLiveRegion="polite"
          />
          <Button
            title="MAIN MENU"
            variant="secondary"
            onPress={handleHome}
          />
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    padding: 24,
    gap: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    gap: rs(8),
  },
  title: {
    fontSize: rf(42, 28, 50),
    fontWeight: '900',
    color: COLORS.neonRed,
    letterSpacing: 6,
    textShadowColor: COLORS.neonRed,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  subtitle: {
    fontSize: rf(16),
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  buttons: {
    width: '100%',
    gap: rs(10),
    marginTop: rs(24),
  },
});
