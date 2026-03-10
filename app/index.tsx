import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import ChipsDisplay from '../components/ChipsDisplay';
import { useGameStore } from '../store/gameStore';
import { COLORS } from '../constants/gameConfig';

export default function HomeScreen() {
  const router = useRouter();
  const chips = useGameStore((s) => s.chips);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.titleSection}>
          <Text style={styles.titleSmall}>♠ ♥ ♦ ♣</Text>
          <Text style={styles.title}>CAPS</Text>
          <Text style={styles.titleSub}>POKER</Text>
        </View>

        <ChipsDisplay amount={chips} label="Your Balance" size="large" />

        <View style={styles.buttonSection}>
          <Pressable
            style={({ pressed }) => [styles.newHandButton, pressed && styles.buttonPressed]}
            onPress={() => router.push('/game')}
          >
            <Text style={styles.newHandText}>NEW HAND</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.settingsButton, pressed && styles.buttonPressed]}
            onPress={() => router.push('/settings')}
          >
            <Text style={styles.settingsText}>⚙ SETTINGS</Text>
          </Pressable>
        </View>

        <Pressable
          style={styles.resetButton}
          onPress={() => useGameStore.getState().setChips(useGameStore.getState().config.startingChips)}
        >
          <Text style={styles.resetText}>Reset Chips</Text>
        </Pressable>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 40,
  },
  titleSection: {
    alignItems: 'center',
  },
  titleSmall: {
    color: COLORS.gold,
    fontSize: 20,
    letterSpacing: 12,
    marginBottom: 8,
  },
  title: {
    fontSize: 64,
    fontWeight: '900',
    color: COLORS.goldBright,
    letterSpacing: 16,
    textShadowColor: COLORS.gold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  titleSub: {
    fontSize: 28,
    fontWeight: '300',
    color: COLORS.textPrimary,
    letterSpacing: 20,
    marginTop: -4,
  },
  buttonSection: {
    width: '100%',
    gap: 12,
  },
  newHandButton: {
    backgroundColor: COLORS.gold,
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  newHandText: {
    color: COLORS.background,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 4,
  },
  settingsButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.boardBorder,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  settingsText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  resetButton: {
    padding: 8,
  },
  resetText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
