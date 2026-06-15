import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore, OrientationType } from '../store/gameStore';
import { COLORS } from '../constants/gameConfig';

// Lazy-load screen orientation (not available on web)
let ScreenOrientation: typeof import('expo-screen-orientation') | null = null;
if (Platform.OS !== 'web') {
  try {
    ScreenOrientation = require('expo-screen-orientation');
  } catch {}
}

export default function OrientationPickScreen() {
  const router = useRouter();
  const setOrientation = useGameStore((s) => s.setOrientation);

  const pick = async (choice: OrientationType) => {
    setOrientation(choice);
    if (ScreenOrientation) {
      try {
        if (choice === 'landscape') {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        } else {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        }
      } catch {}
    }
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>CAPS POKER</Text>
      <Text style={styles.subtitle}>CHOOSE YOUR PLAY STYLE</Text>

      <View style={styles.cardsRow}>
        {/* Portrait */}
        <Pressable style={styles.card} onPress={() => pick('portrait')}>
          <Text style={styles.cardIcon}>📱</Text>
          <Text style={styles.cardName}>PORTRAIT</Text>
          <Text style={styles.cardTag}>Classic</Text>
          <Text style={styles.cardDesc}>Phone held vertically{'\n'}Standard layout</Text>
          <View style={styles.selectBtn}>
            <Text style={styles.selectBtnText}>SELECT</Text>
          </View>
        </Pressable>

        {/* Widescreen */}
        <Pressable style={[styles.card, styles.cardPro]} onPress={() => pick('landscape')}>
          <Text style={styles.cardIcon}>🖥️</Text>
          <Text style={[styles.cardName, { color: COLORS.mint }]}>WIDESCREEN</Text>
          <Text style={[styles.cardTag, { color: COLORS.mint }]}>Pro</Text>
          <Text style={styles.cardDesc}>Phone/tablet horizontal{'\n'}Side-by-side boards</Text>
          <View style={[styles.selectBtn, styles.selectBtnGold]}>
            <Text style={[styles.selectBtnText, { color: COLORS.background }]}>SELECT</Text>
          </View>
        </Pressable>
      </View>

      <Text style={styles.hint}>Can be changed anytime in Settings</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  title: {
    color: COLORS.mint,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 5,
    marginBottom: 8,
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    letterSpacing: 3,
    fontWeight: '700',
    marginBottom: 48,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
    maxWidth: 420,
  },
  card: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.boardBorder,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  cardPro: {
    borderColor: COLORS.mint,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.mint,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
      default: {
        boxShadow: '0 0 16px rgba(201,168,76,0.2)',
      } as any,
    }),
  },
  cardIcon: {
    fontSize: 40,
    marginBottom: 4,
  },
  cardName: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
  },
  cardTag: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  cardDesc: {
    color: COLORS.textDim,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 17,
    marginVertical: 4,
  },
  selectBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: COLORS.boardBorder,
    backgroundColor: 'transparent',
  },
  selectBtnGold: {
    backgroundColor: COLORS.mint,
    borderColor: COLORS.mint,
  },
  selectBtnText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },
  hint: {
    marginTop: 40,
    color: COLORS.textMuted,
    fontSize: 10,
    letterSpacing: 1,
  },
});
