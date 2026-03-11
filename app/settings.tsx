import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { useGameStore } from '../store/gameStore';
import { DEFAULT_CONFIG, COLORS, GameConfig } from '../constants/gameConfig';

interface SettingRowProps {
  label: string;
  configKey: keyof GameConfig;
  suffix?: string;
}

function SettingRow({ label, configKey, suffix }: SettingRowProps) {
  const value = useGameStore((s) => s.config[configKey]);
  const updateConfig = useGameStore((s) => s.updateConfig);

  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowKey}>{configKey}</Text>
      </View>
      <View style={styles.rowRight}>
        <TextInput
          style={styles.input}
          value={value.toString()}
          onChangeText={(text) => {
            const num = parseInt(text, 10);
            if (!isNaN(num)) {
              updateConfig({ [configKey]: num });
            }
          }}
          keyboardType="numeric"
          selectTextOnFocus
        />
        {suffix && <Text style={styles.suffix}>{suffix}</Text>}
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const resetConfig = useGameStore((s) => s.resetConfig);
  const navigateToSimulation = () => router.push('/simulate');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>SETTINGS</Text>
        <Button title="Reset" variant="secondary" onPress={resetConfig} style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>TIMING</Text>
        <SettingRow label="Arrangement Time" configKey="arrangementTime" suffix="sec" />
        <SettingRow label="Board Reveal Duration" configKey="boardRevealDuration" suffix="sec" />
        <SettingRow label="Complete Bonus Display" configKey="completeBonusDisplay" suffix="sec" />

        <Text style={styles.sectionTitle}>CHIPS</Text>
        <SettingRow label="Starting Chips" configKey="startingChips" />
        <SettingRow label="Pot Per Board" configKey="potPerBoard" />
        <SettingRow label="Complete Bonus %" configKey="completeBonusPercent" suffix="%" />

        <Text style={styles.sectionTitle}>BOT</Text>
        <SettingRow label="Bot Speed Min" configKey="botSpeedMin" suffix="ms" />
        <SettingRow label="Bot Speed Max" configKey="botSpeedMax" suffix="ms" />

        <Text style={styles.sectionTitle}>DEBUG</Text>
        <Button title="Simulation Mode" variant="secondary" onPress={navigateToSimulation} style={{ marginBottom: 12 }} />

        <View style={styles.defaultsSection}>
          <Text style={styles.defaultsTitle}>Defaults</Text>
          {Object.entries(DEFAULT_CONFIG).map(([key, val]) => (
            <View key={key} style={styles.defaultRow}>
              <Text style={styles.defaultKey}>{key}</Text>
              <Text style={styles.defaultVal}>{val}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.boardBorder,
  },
  backButton: {
    padding: 4,
  },
  backText: {
    color: COLORS.textSecondary,
    fontSize: 15,
  },
  title: {
    color: COLORS.goldBright,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 4,
  },
  sectionTitle: {
    color: COLORS.gold,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 3,
    marginTop: 20,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.feltLight,
    padding: 12,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
  },
  rowLeft: {
    flex: 1,
  },
  rowLabel: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  rowKey: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  input: {
    backgroundColor: COLORS.background,
    color: COLORS.goldBright,
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 70,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
  },
  suffix: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  defaultsSection: {
    marginTop: 24,
    padding: 12,
    backgroundColor: COLORS.feltLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
  },
  defaultsTitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  defaultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  defaultKey: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  defaultVal: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: 'monospace',
  },
});
