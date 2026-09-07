import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore, VisualTheme } from '../store/gameStore';
import { COLORS } from '../constants/gameConfig';
import { t, getLanguage } from '../utils/i18n';

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
      <Text style={styles.subtitle} accessibilityLanguage={getLanguage() === 'he' ? 'he' : undefined}>{t().setChooseStyle}</Text>

      <View style={styles.cardsRow}>
        {/* CLASSIC */}
        {/* THE-ONE-DAY 2026-08-22 — both tiles WORK (tapping FIVE-O persists visualTheme
            classic -> fiveo, measured) but were div, AT:N — no role, no name, so this whole screen
            exposed zero buttons. */}
        <Pressable
          style={styles.card}
          onPress={() => pick('classic')}
          accessibilityRole="button"
          accessibilityLabel={`${t().setThemeTimeless} — ${t().setThemeClassicDesc.replace(String.fromCharCode(10), ", ")}`} accessibilityLanguage={getLanguage() === 'he' ? 'he' : undefined}
        >
          <View style={styles.classicPreview}>
            <Text style={styles.classicPreviewText}>♠</Text>
            <View style={styles.classicPreviewBar} />
          </View>
          <Text style={styles.cardName}>CLASSIC</Text>
          <Text style={styles.cardTag} accessibilityLanguage={getLanguage() === 'he' ? 'he' : undefined}>{t().setThemeTimeless}</Text>
          <Text style={styles.cardDesc} accessibilityLanguage={getLanguage() === 'he' ? 'he' : undefined}>{t().setThemeClassicDesc}</Text>
          <View style={styles.selectBtn}>
            <Text style={styles.selectBtnText} accessibilityLanguage={getLanguage() === 'he' ? 'he' : undefined}>{t().setSelect}</Text>
          </View>
        </Pressable>

        {/* FIVE-O */}
        <Pressable
          style={[styles.card, styles.fiveoCard]}
          onPress={() => pick('fiveo')}
          accessibilityRole="button"
          accessibilityLabel={`${t().setThemeModern} — ${t().setThemeFiveoDesc.replace(String.fromCharCode(10), ", ")}`} accessibilityLanguage={getLanguage() === 'he' ? 'he' : undefined}
        >
          <View style={styles.fiveoPreview}>
            <Text style={styles.fiveoPreviewText}>♠</Text>
            <View style={styles.fiveoPreviewBar} />
          </View>
          <Text style={[styles.cardName, { color: '#4FD6A8' }]}>FIVE-O</Text>
          <Text style={[styles.cardTag, { color: '#4FD6A8' }]} accessibilityLanguage={getLanguage() === 'he' ? 'he' : undefined}>{t().setThemeModern}</Text>
          <Text style={styles.cardDesc} accessibilityLanguage={getLanguage() === 'he' ? 'he' : undefined}>{t().setThemeFiveoDesc}</Text>
          {/* THE-LAST-THREE 2026-09-03 — this SELECT was a SOLID #4FD6A8 fill. #4FD6A8 is the
              winner cue; no control may wear it. Both SELECT controls now share one neutral
              chrome, and FIVE-O's identity stays where it belongs: the preview swatch, the
              gold card name/tag, and the card border. */}
          <View style={styles.selectBtn}>
            <Text style={styles.selectBtnText} accessibilityLanguage={getLanguage() === 'he' ? 'he' : undefined}>{t().setSelect}</Text>
          </View>
        </Pressable>
      </View>

      <Text style={styles.hint} accessibilityLanguage={getLanguage() === 'he' ? 'he' : undefined}>{t().setChangeAnytime}</Text>
    </SafeAreaView>
  );
}

// THE-LAST-THREE 2026-09-03 — FIVE-O's swatch accent was #FFD700, THE WINNER CUE, and the whole
// card is a Pressable, so the loop measured it as gold ON a control in both engines at all four
// widths. (A previous edit here rewrote this very note with a blanket colour replace and left it
// claiming the cue was #4FD6A8. It is not. #FFD700 is the cue; #4FD6A8 is the mint that replaced
// it. Corrected 2026-09-03.)
//
// FULL-I18N 2026-09-03 — the rest of the swatch is now corrected too. constants/paintThemes.ts
// `visual.fiveo` paints:   accent #4FD6A8 · surface #1A1A2E (navy) · boardGold #c9a84c
// The preview box was #5c0000 and the copy said "Red felt / Bold action". FIVE-O has not been red
// for a long time, so the swatch was describing a theme that no longer exists — the same class of
// error as the maroon-felt line corrected in CLAUDE.md. Preview and copy now match the paint.
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
    borderColor: '#4FD6A8',
    ...Platform.select({
      ios: {
        shadowColor: '#4FD6A8',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
      default: {
        boxShadow: '0 0 16px rgba(79,214,168,0.2)',
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
    backgroundColor: '#1A1A2E',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4FD6A8',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 4,
  },
  fiveoPreviewText: {
    color: '#4FD6A8',
    fontSize: 22,
    fontWeight: '900',
  },
  fiveoPreviewBar: {
    width: 40,
    height: 4,
    backgroundColor: '#4FD6A8',
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
