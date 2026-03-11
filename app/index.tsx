import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import ChipsDisplay from '../components/ChipsDisplay';
import { Button } from '../components/Button';
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
          <Button title="NEW HAND (vs Bot)" variant="gold" onPress={() => router.push('/game')} />
          <Button title="HOST GAME" variant="secondary" onPress={() => router.push('/lobby/host')} />
          <Button title="JOIN GAME" variant="secondary" onPress={() => router.push('/lobby/join')} />
          <Button title="SETTINGS" variant="ghost" onPress={() => router.push('/settings')} />
        </View>

        <Button
          title="Reset Chips"
          variant="ghost"
          onPress={() => useGameStore.getState().setChips(useGameStore.getState().config.startingChips)}
        />
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
});
