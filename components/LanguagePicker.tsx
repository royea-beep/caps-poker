/**
 * LanguagePicker — first-launch language selection screen.
 * Shown when no 'caps_language' key exists in AsyncStorage.
 * Bilingual so any user can read it regardless of device language.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import type { Language } from '../utils/i18n';

export interface LanguagePickerProps {
  onSelect: (lang: Language) => void;
}

export function LanguagePicker({ onSelect }: LanguagePickerProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.suits}>♠ ♥ ♦ ♣</Text>
      <Text style={styles.title}>CAPS POKER</Text>
      <Text style={styles.subtitle}>Choose your language / בחר את השפה שלך</Text>

      <View style={styles.buttonsContainer}>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={() => onSelect('en')}
        >
          <Text style={styles.buttonText}>🇬🇧  English</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={() => onSelect('he')}
        >
          <Text style={styles.buttonText}>🇮🇱  עברית</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0700',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  suits: {
    fontSize: 22,
    color: '#c96a1a',
    letterSpacing: 10,
    marginBottom: 16,
    opacity: 0.8,
  },
  title: {
    fontSize: 38,
    fontWeight: '900',
    color: '#c96a1a',
    letterSpacing: 5,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#a08060',
    letterSpacing: 1,
    marginBottom: 48,
    textAlign: 'center',
  },
  buttonsContainer: {
    width: '100%',
    gap: 16,
  },
  button: {
    height: 60,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#3d2a1a',
    backgroundColor: 'rgba(61,42,26,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: 'rgba(201,106,26,0.2)',
    borderColor: '#c96a1a',
  },
  buttonText: {
    color: '#f5e6d3',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
