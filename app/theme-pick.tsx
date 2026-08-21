import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore, VisualTheme } from '../store/gameStore';
import { COLORS } from '../constants/gameConfig';

export default function ThemePickScreen() {
  const router = useRouter();
  const setVisualTheme = useGameStore((s) => s.setVisualTheme);
  const orientation = useGameStore((s) => s.orientation);

  const pick = (choice: VisualTheme) => {
    setVisualTheme(choice);
    // After theme pick → orientation pick (if not set) or home
    if (!orientation) {
      router.replace('/orientation-pick');
    } else {
      router.replace('/');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>CAPS POKER</Text>
      <Text style={styles.subtitle}>CHOOSE YOUR STYLE</Text>

      <View style={styles.cardsRow}>
        {/* CLASSIC */}
        {/* THE-ONE-DAY 2026-08-22 — both tiles WORK (tapping FIVE-O persists visualTheme
            classic -> fiveo, measured) but were div, AT:N — no role, no name, so this whole screen
            exposed zero buttons. */}
        <Pressable
          style={styles.card}
          onPress={() => pick('classic')}
          accessibilityRole="button"
          accessibilityLabel="Choose Classic style, timeless dark gold, elegant look"
        >
          <View style={styles.classicPreview}>
            <Text style={styles.classicPreviewText}>♠</Text>
            <View style={styles.classicPreviewBar} />
          </View>
          <Text style={styles.cardName}>CLASSIC</Text>
          <Text style={styles.cardTag}>Timeless</Text>
          <Text style={styles.cardDesc}>Dark gold{'\n'}Elegant look</Text>
          <View style={styles.selectBtn}>
            <Text style={styles.selectBtnText}>SELECT</Text>
          </View>
        </Pressable>

        {/* FIVE-O */}
        <Pressable
          style={[styles.card, styles.fiveoCard]}
          onPress={() => pick('fiveo')}
          accessibilityRole="button"
          accessibilityLabel="Choose Five-O style, arcade red felt, bold action"
        >
          <View style={styles.fiveoPreview}>
            <Text style={styles.fiveoPreviewText}>♠</Text>
            <View style={styles.fiveoPreviewBar} />
          </View>
          <Text style={[styles.cardName, { color: '#FFD700' }]}>FIVE-O</Text>
          <Text style={[styles.cardTag, { color: '#FFD700' }]}>Arcade</Text>
          <Text style={styles.cardDesc}>Red felt{'\n'}Bold action</Text>
          <View style={[styles.selectBtn, styles.selectBtnFiveo]}>
            <Text style={[styles.selectBtnText, { color: '#000000' }]}>SELECT</Text>
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
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  title: {
    color: '#c9a84c',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 5,
    marginBottom: 8,
  },
  subtitle: {
    color: '#666666',
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
    backgroundColor: '#111111',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#3d2010',
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  fiveoCard: {
    borderColor: '#FFD700',
    ...Platform.select({
      ios: {
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
      default: {
        boxShadow: '0 0 16px rgba(255,215,0,0.2)',
      } as any,
    }),
  },
  // Classic preview box
  classicPreview: {
    width: 60,
    height: 50,
    backgroundColor: '#1a0800',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c9a84c',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 4,
  },
  classicPreviewText: {
    color: '#c9a84c',
    fontSize: 22,
    fontWeight: '900',
  },
  classicPreviewBar: {
    width: 40,
    height: 4,
    backgroundColor: '#c9a84c',
    borderRadius: 2,
    opacity: 0.6,
  },
  // Five-O preview box
  fiveoPreview: {
    width: 60,
    height: 50,
    backgroundColor: '#5c0000',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 4,
  },
  fiveoPreviewText: {
    color: '#FFD700',
    fontSize: 22,
    fontWeight: '900',
  },
  fiveoPreviewBar: {
    width: 40,
    height: 4,
    backgroundColor: '#FFD700',
    borderRadius: 2,
    opacity: 0.8,
  },
  cardName: {
    color: '#f0f0e8',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
  },
  cardTag: {
    color: '#666666',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  cardDesc: {
    color: '#555555',
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
    borderColor: '#3d2010',
    backgroundColor: 'transparent',
  },
  selectBtnFiveo: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },
  selectBtnText: {
    color: '#c9a84c',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },
  hint: {
    marginTop: 40,
    color: '#444444',
    fontSize: 10,
    letterSpacing: 1,
  },
});
