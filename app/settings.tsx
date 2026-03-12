import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { useGameStore } from '../store/gameStore';
import { DEFAULT_CONFIG, COLORS, GameConfig, getBoardCount } from '../constants/gameConfig';

interface SettingRowProps {
  label: string;
  configKey: keyof GameConfig;
  suffix?: string;
  min?: number;
  max?: number;
}

function SettingRow({ label, configKey, suffix, min = 1, max }: SettingRowProps) {
  const value = useGameStore((s) => s.config[configKey]);
  const updateConfig = useGameStore((s) => s.updateConfig);
  const [localText, setLocalText] = useState(value.toString());
  const [error, setError] = useState<string | null>(null);

  // Sync local text when store value changes externally (e.g. reset)
  useEffect(() => {
    setLocalText(value.toString());
    setError(null);
  }, [value]);

  const commitValue = () => {
    const num = parseInt(localText, 10);
    if (isNaN(num) || num < min || (max !== undefined && num > max)) {
      setError(`${min}${max !== undefined ? `–${max}` : '+'}`);
      setLocalText(value.toString());
    } else {
      setError(null);
      updateConfig({ [configKey]: num });
    }
  };

  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowLabel}>{label}</Text>
        {error && <Text style={styles.rowError}>Min: {error}</Text>}
      </View>
      <View style={styles.rowRight}>
        <TextInput
          style={[styles.input, error && styles.inputError]}
          value={localText}
          onChangeText={setLocalText}
          onBlur={commitValue}
          onSubmitEditing={commitValue}
          keyboardType="numeric"
          selectTextOnFocus
        />
        {suffix && <Text style={styles.suffix}>{suffix}</Text>}
      </View>
    </View>
  );
}

function PlayerNameInput() {
  const playerName = useGameStore((s) => s.playerName);
  const setPlayerName = useGameStore((s) => s.setPlayerName);
  const [localText, setLocalText] = useState(playerName);

  useEffect(() => {
    setLocalText(playerName);
  }, [playerName]);

  const commitValue = () => {
    const trimmed = localText.trim().slice(0, 20);
    setPlayerName(trimmed);
    setLocalText(trimmed);
  };

  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowLabel}>Player Name</Text>
        <Text style={styles.rowHint}>Shown on leaderboard</Text>
      </View>
      <TextInput
        style={[styles.input, { minWidth: 120 }]}
        value={localText}
        onChangeText={setLocalText}
        onBlur={commitValue}
        onSubmitEditing={commitValue}
        placeholder="Your name"
        placeholderTextColor={COLORS.textMuted}
        maxLength={20}
        selectTextOnFocus
      />
    </View>
  );
}

function NotificationsToggle() {
  const enabled = useGameStore((s) => s.notificationsEnabled);
  const setEnabled = useGameStore((s) => s.setNotificationsEnabled);

  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowLabel}>Push Notifications</Text>
      </View>
      <Pressable
        onPress={() => setEnabled(!enabled)}
        style={[styles.toggleBtn, enabled && styles.toggleBtnActive]}
      >
        <Text style={[styles.toggleText, enabled && styles.toggleTextActive]}>
          {enabled ? 'ON' : 'OFF'}
        </Text>
      </Pressable>
    </View>
  );
}

function SoundToggle() {
  const soundEnabled = useGameStore((s) => s.config.soundEnabled);
  const updateConfig = useGameStore((s) => s.updateConfig);

  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowLabel}>Sound Effects</Text>
      </View>
      <Pressable
        onPress={() => updateConfig({ soundEnabled: !soundEnabled })}
        style={[styles.toggleBtn, soundEnabled && styles.toggleBtnActive]}
      >
        <Text style={[styles.toggleText, soundEnabled && styles.toggleTextActive]}>
          {soundEnabled ? 'ON' : 'OFF'}
        </Text>
      </Pressable>
    </View>
  );
}

function PlayerCountSelector() {
  const value = useGameStore((s) => s.config.numberOfPlayers);
  const updateConfig = useGameStore((s) => s.updateConfig);

  const labels: Record<number, string> = {
    2: '2 Players (vs 1 Bot)',
    3: '3 Players (vs 2 Bots)',
    4: '4 Players (vs 3 Bots)',
  };

  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowLabel}>Players</Text>
        <Text style={styles.rowHint}>{labels[value] || `${value} Players`}</Text>
      </View>
      <View style={styles.selectorRow}>
        {([2, 3, 4] as const).map((n) => (
          <Pressable
            key={n}
            onPress={() => updateConfig({ numberOfPlayers: n })}
            style={[styles.selectorBtn, value === n && styles.selectorBtnActive]}
          >
            <Text style={[styles.selectorText, value === n && styles.selectorTextActive]}>
              {n}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const config = useGameStore((s) => s.config);
  const resetConfig = useGameStore((s) => s.resetConfig);
  const navigateToSimulation = () => router.push('/simulate');

  const boardCount = getBoardCount(config.numberOfPlayers);
  const buyIn = config.potPerBoard * boardCount;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>SETTINGS</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>PROFILE</Text>
        <PlayerNameInput />

        <Text style={styles.sectionTitle}>GAMEPLAY</Text>
        <PlayerCountSelector />
        <SettingRow label="Starting Chips" configKey="startingChips" min={1} />
        <SettingRow label="Pot Per Board" configKey="potPerBoard" suffix={`× ${boardCount} boards = ${buyIn}`} min={1} />
        <SettingRow label="Complete Bonus %" configKey="completeBonusPercent" suffix="% of buy-in" min={0} max={100} />

        <Text style={styles.sectionTitle}>TIMING</Text>
        <SettingRow label="Arrangement Time" configKey="arrangementTime" suffix="sec" min={10} />
        <SettingRow label="Board Reveal Duration" configKey="boardRevealDuration" suffix="sec" min={1} />
        <SettingRow label="Card Flip Speed" configKey="turnRevealDelay" suffix="ms" min={100} />
        <SettingRow label="Complete Bonus Display" configKey="completeBonusDisplay" suffix="sec" min={1} />

        <Text style={styles.sectionTitle}>BOT</Text>
        <SettingRow label="Bot Speed Min" configKey="botSpeedMin" suffix="ms" min={0} />
        <SettingRow label="Bot Speed Max" configKey="botSpeedMax" suffix="ms" min={0} />

        <Text style={styles.sectionTitle}>AUDIO &amp; NOTIFICATIONS</Text>
        <SoundToggle />
        <NotificationsToggle />

        <Text style={styles.sectionTitle}>TOOLS</Text>
        <Button title="Simulation Mode" variant="secondary" onPress={navigateToSimulation} style={{ marginBottom: 12 }} />

        <Button
          title="Reset to Defaults"
          variant="secondary"
          onPress={resetConfig}
          style={{ marginBottom: 24 }}
        />
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
  rowHint: {
    color: COLORS.textSecondary,
    fontSize: 10,
    marginTop: 2,
  },
  rowError: {
    color: COLORS.danger,
    fontSize: 10,
    fontWeight: '600',
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
  inputError: {
    borderColor: COLORS.danger,
  },
  suffix: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  selectorRow: {
    flexDirection: 'row',
    gap: 6,
  },
  selectorBtn: {
    width: 40,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
  },
  selectorBtnActive: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
  },
  selectorText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
  selectorTextActive: {
    color: COLORS.background,
  },
  toggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
  },
  toggleBtnActive: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
  },
  toggleText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  toggleTextActive: {
    color: COLORS.background,
  },
});
