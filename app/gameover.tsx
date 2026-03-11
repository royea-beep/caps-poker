import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import ChipsDisplay from '../components/ChipsDisplay';
import { Button } from '../components/Button';
import { useGameStore } from '../store/gameStore';
import { COLORS } from '../constants/gameConfig';

export default function GameOverScreen() {
  const router = useRouter();
  const chips = useGameStore((s) => s.chips);
  const config = useGameStore((s) => s.config);
  const setChips = useGameStore((s) => s.setChips);

  const handlePlayAgain = () => {
    setChips(config.startingChips);
    router.replace('/game');
  };

  const handleHome = () => {
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.View entering={FadeIn.duration(600)} style={styles.header}>
          <Text style={styles.title}>GAME OVER</Text>
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
            title="PLAY AGAIN"
            variant="gold"
            onPress={handlePlayAgain}
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
    gap: 8,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: COLORS.danger,
    letterSpacing: 6,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  buttons: {
    width: '100%',
    gap: 10,
    marginTop: 24,
  },
});
