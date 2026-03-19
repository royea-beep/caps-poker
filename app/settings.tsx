import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Platform } from 'react-native';
// CSSProperties used for web-only <img> elements inside FriendsBgPicker

// Lazy haptics — web-safe
let Haptics: typeof import('expo-haptics') | null = null;
if (Platform.OS !== 'web') {
  try {
    Haptics = require('expo-haptics');
  } catch {}
}

function hapticLight() {
  if (!Haptics) return;
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  } catch {}
}
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import CardComponent from '../components/Card';
import { useGameStore } from '../store/gameStore';
import { DEFAULT_CONFIG, COLORS, GameConfig, getBoardCount } from '../constants/gameConfig';
import { CARD_THEMES, CardThemeId } from '../constants/cardThemes';
import { HOME_THEMES, HOME_THEME_NAMES, HomeThemeId, ButtonStyle } from '../constants/homeThemes';
import { FRIENDS_BGS, FriendsBgId } from '../constants/friendsBgs';
import { CapsHooks } from '../utils/learning';
import { OrientationType } from '../store/gameStore';

// Lazy-load screen orientation (not available on web)
let ScreenOrientation: typeof import('expo-screen-orientation') | null = null;
if (Platform.OS !== 'web') {
  try {
    ScreenOrientation = require('expo-screen-orientation');
  } catch {}
}

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
      CapsHooks.settingsChanged(configKey, num);
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
        onPress={() => { setEnabled(!enabled); CapsHooks.settingsChanged('notifications', !enabled); }}
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
        onPress={() => { updateConfig({ soundEnabled: !soundEnabled }); CapsHooks.settingsChanged('soundEnabled', !soundEnabled); }}
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
            onPress={() => { updateConfig({ numberOfPlayers: n }); CapsHooks.settingsChanged('numberOfPlayers', n); }}
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

function OrientationPicker() {
  const orientation = useGameStore((s) => s.orientation);
  const setOrientation = useGameStore((s) => s.setOrientation);

  const pick = async (choice: OrientationType) => {
    hapticLight();
    setOrientation(choice);
    if (ScreenOrientation) {
      try {
        const lock = choice === 'landscape'
          ? ScreenOrientation.OrientationLock.LANDSCAPE
          : ScreenOrientation.OrientationLock.PORTRAIT_UP;
        await ScreenOrientation.lockAsync(lock);
      } catch {}
    }
  };

  const opts: { id: OrientationType; label: string; icon: string }[] = [
    { id: 'portrait', label: 'Portrait', icon: '📱' },
    { id: 'landscape', label: 'Widescreen', icon: '🖥️' },
  ];

  return (
    <View style={orientationStyles.row}>
      {opts.map(({ id, label, icon }) => {
        const active = orientation === id;
        return (
          <Pressable
            key={id}
            onPress={() => pick(id)}
            style={[orientationStyles.tile, active && orientationStyles.tileActive]}
          >
            <Text style={orientationStyles.tileIcon}>{icon}</Text>
            <Text style={[orientationStyles.tileLabel, active && orientationStyles.tileLabelActive]}>{label}</Text>
            {active && <Text style={[orientationStyles.check, { color: COLORS.gold }]}>✓</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

function FourColorSuitsToggle() {
  const fourColorSuits = useGameStore((s) => s.fourColorSuits);
  const setFourColorSuits = useGameStore((s) => s.setFourColorSuits);

  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowLabel}>Suit Colors</Text>
        <Text style={styles.rowHint}>{fourColorSuits ? '4-color: ♥red ♦blue ♠black ♣green' : '2-color: red / black'}</Text>
      </View>
      <View style={styles.selectorRow}>
        <Pressable
          onPress={() => { hapticLight(); setFourColorSuits(false); }}
          style={[styles.selectorBtn, !fourColorSuits && styles.selectorBtnActive]}
        >
          <Text style={[styles.selectorText, !fourColorSuits && styles.selectorTextActive]}>2</Text>
        </Pressable>
        <Pressable
          onPress={() => { hapticLight(); setFourColorSuits(true); }}
          style={[styles.selectorBtn, fourColorSuits && styles.selectorBtnActive]}
        >
          <Text style={[styles.selectorText, fourColorSuits && styles.selectorTextActive]}>4</Text>
        </Pressable>
      </View>
    </View>
  );
}

// Preview cards: A♠ (face-up) + face-down
const ACE_SPADES = { rank: 'A' as const, suit: 'spades' as const, id: 'preview-as' };
const KING_HEARTS = { rank: 'K' as const, suit: 'hearts' as const, id: 'preview-kh' };

function CardThemePicker() {
  const cardTheme = useGameStore((s) => s.cardTheme);
  const setCardTheme = useGameStore((s) => s.setCardTheme);

  return (
    <View style={themeStyles.pickerRow}>
      {(['v1', 'v2', 'v3'] as CardThemeId[]).map((id) => {
        const t = CARD_THEMES[id];
        const active = cardTheme === id;
        return (
          <Pressable
            key={id}
            onPress={() => { hapticLight(); setCardTheme(id); }}
            style={[themeStyles.themeBtn, active && themeStyles.themeBtnActive]}
          >
            <Text style={[themeStyles.themeBtnLabel, active && themeStyles.themeBtnLabelActive]}>
              {t.name}
            </Text>
            <View style={themeStyles.previewRow}>
              <CardComponent
                card={ACE_SPADES}
                faceDown={false}
                cardWidth={32}
                cardHeight={46}
                themeOverride={id}
              />
              <CardComponent
                card={KING_HEARTS}
                faceDown={false}
                cardWidth={32}
                cardHeight={46}
                themeOverride={id}
              />
              <CardComponent
                faceDown
                cardWidth={32}
                cardHeight={46}
                themeOverride={id}
              />
            </View>
            {active && (
              <View style={themeStyles.activePill}>
                <Text style={themeStyles.activePillText}>✓ Active</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function HomeThemePicker() {
  const homeTheme = useGameStore((s) => s.homeTheme);
  const setHomeTheme = useGameStore((s) => s.setHomeTheme);
  const allIds = Object.keys(HOME_THEMES) as HomeThemeId[];
  const rows = [allIds.slice(0, 5), allIds.slice(5, 10)];

  return (
    <View style={homeThemeStyles.container}>
      {rows.map((row, rowIdx) => (
        <View key={rowIdx} style={homeThemeStyles.swatchRow}>
          {row.map((id) => {
            const t = HOME_THEMES[id];
            const active = homeTheme === id;
            return (
              <Pressable
                key={id}
                onPress={() => { hapticLight(); setHomeTheme(id); }}
                style={homeThemeStyles.swatchItem}
              >
                <View
                  style={[
                    homeThemeStyles.swatchCircle,
                    { backgroundColor: t.accent },
                    active && homeThemeStyles.swatchCircleActive,
                  ]}
                >
                  {active && <Text style={homeThemeStyles.swatchCheck}>✓</Text>}
                </View>
                <Text style={[homeThemeStyles.swatchLabel, { color: active ? t.accent : COLORS.textMuted }]}>
                  {HOME_THEME_NAMES[id]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function ButtonStylePicker() {
  const buttonStyle = useGameStore((s) => s.buttonStyle);
  const setButtonStyle = useGameStore((s) => s.setButtonStyle);
  const homeTheme = useGameStore((s) => s.homeTheme);
  const t = HOME_THEMES[homeTheme];

  const options: { id: ButtonStyle; label: string }[] = [
    { id: 'solid', label: 'Solid' },
    { id: 'glass', label: 'Glass' },
    { id: 'outline', label: 'Outline' },
  ];

  return (
    <View style={btnStyleStyles.row}>
      {options.map(({ id, label }) => {
        const active = buttonStyle === id;
        const previewBg =
          id === 'solid' ? t.accent
          : id === 'glass' ? t.accent + '30'
          : 'transparent';
        const previewBorder = id === 'solid' ? undefined : t.accent;
        const previewText = id === 'solid' ? t.buttonPrimaryText : t.accent;
        return (
          <Pressable
            key={id}
            onPress={() => { hapticLight(); setButtonStyle(id); }}
            style={[btnStyleStyles.option, active && { borderColor: t.accent, borderWidth: 2 }]}
          >
            <View style={[
              btnStyleStyles.preview,
              { backgroundColor: previewBg },
              previewBorder ? { borderColor: previewBorder, borderWidth: 1.5 } : undefined,
            ]}>
              <Text style={[btnStyleStyles.previewText, { color: previewText }]}>BTN</Text>
            </View>
            <Text style={[btnStyleStyles.label, { color: active ? t.accent : COLORS.textSecondary }]}>
              {label}
            </Text>
            {active && <Text style={[btnStyleStyles.check, { color: t.accent }]}>✓</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

const BG_OPTIONS: { id: FriendsBgId; label: string; hint: string }[] = [
  { id: 'none', label: 'None', hint: 'No bg' },
  { id: 'sofa', label: 'Sofa', hint: 'Central Perk' },
  { id: 'logo', label: 'Logo', hint: 'C. Perk sign' },
  { id: 'fountain', label: 'Fountain', hint: 'NYC fountain' },
];

function FriendsBgPicker() {
  const friendsBg = useGameStore((s) => s.friendsBg ?? 'none');
  const setFriendsBg = useGameStore((s) => s.setFriendsBg);

  return (
    <View style={bgPickerStyles.row}>
      {BG_OPTIONS.map(({ id, label, hint }) => {
        const active = friendsBg === id;
        const entry = id !== 'none' ? FRIENDS_BGS[id as Exclude<FriendsBgId, 'none'>] : null;
        return (
          <Pressable
            key={id}
            onPress={() => { hapticLight(); setFriendsBg(id); }}
            style={[bgPickerStyles.tile, active && bgPickerStyles.tileActive]}
          >
            {Platform.OS === 'web' && entry ? (
              <img
                alt={label}
                src={`data:image/svg+xml;utf8,${encodeURIComponent(entry.svg('#c8a84b'))}`}
                style={{ width: 48, height: 28, opacity: 0.9 } as React.CSSProperties}
              />
            ) : (
              <View style={bgPickerStyles.noPreview} />
            )}
            <Text style={[bgPickerStyles.tileLabel, active && bgPickerStyles.tileLabelActive]}>
              {label}
            </Text>
            <Text style={bgPickerStyles.tileHint}>{hint}</Text>
            {active && <Text style={[bgPickerStyles.check, { color: COLORS.gold }]}>✓</Text>}
          </Pressable>
        );
      })}
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
        <Text style={styles.sectionTitle}>📱 ORIENTATION</Text>
        <OrientationPicker />

        <Text style={styles.sectionTitle}>🖼️ BACKGROUND THEME</Text>
        <FriendsBgPicker />

        <Text style={styles.sectionTitle}>PROFILE</Text>
        <PlayerNameInput />

        <Text style={styles.sectionTitle}>GAMEPLAY</Text>
        <PlayerCountSelector />
        <SettingRow label="Starting Chips" configKey="startingChips" min={1} />
        <SettingRow label="Pot Per Board" configKey="potPerBoard" suffix={`× ${boardCount} boards = ${buyIn}`} min={1} />
        <SettingRow label="Complete Bonus %" configKey="completeBonusPercent" suffix="% of buy-in" min={0} max={100} />

        <Text style={styles.sectionTitle}>🏠 HOME THEME</Text>
        <HomeThemePicker />

        <Text style={styles.sectionTitle}>🎨 BUTTON STYLE</Text>
        <ButtonStylePicker />

        <Text style={styles.sectionTitle}>🃏 עיצוב קלפים</Text>
        <CardThemePicker />
        <FourColorSuitsToggle />

        <Text style={styles.sectionTitle}>TIMING</Text>
        <SettingRow label="Arrangement Time" configKey="arrangementTime" suffix="sec" min={10} />
        <SettingRow label="Board Reveal Duration" configKey="boardRevealDuration" suffix="sec" min={1} />
        <SettingRow label="Card Flip Speed" configKey="turnRevealDelay" suffix="ms" min={100} />
        <SettingRow label="Complete Bonus Display" configKey="completeBonusDisplay" suffix="sec" min={1} />

        <Text style={styles.sectionTitle}>BOT</Text>
        <SettingRow label="Bot Speed Min" configKey="botSpeedMin" suffix="ms" min={0} />
        <SettingRow label="Bot Speed Max" configKey="botSpeedMax" suffix="ms" min={0} />

        <Text style={styles.sectionTitle}>AUDIO & NOTIFICATIONS</Text>
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

const themeStyles = StyleSheet.create({
  pickerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  themeBtn: {
    flex: 1,
    backgroundColor: COLORS.feltLight,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.boardBorder,
    padding: 10,
    alignItems: 'center',
    gap: 8,
  },
  themeBtnActive: {
    borderColor: COLORS.gold,
    borderWidth: 2,
  },
  themeBtnLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  themeBtnLabelActive: {
    color: COLORS.gold,
  },
  previewRow: {
    flexDirection: 'row',
    gap: 3,
    justifyContent: 'center',
  },
  activePill: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activePillText: {
    color: COLORS.background,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});

const homeThemeStyles = StyleSheet.create({
  container: {
    gap: 8,
    marginBottom: 6,
  },
  swatchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  swatchItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  swatchCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchCircleActive: {
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  swatchCheck: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
  },
  swatchLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
});

const bgPickerStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  tile: {
    flex: 1,
    backgroundColor: COLORS.feltLight,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.boardBorder,
    padding: 10,
    alignItems: 'center',
    gap: 4,
    minHeight: 80,
    justifyContent: 'center',
  },
  tileActive: {
    borderColor: COLORS.gold,
    borderWidth: 2,
  },
  noPreview: {
    width: 48,
    height: 28,
  },
  tileLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tileLabelActive: {
    color: COLORS.gold,
  },
  tileHint: {
    color: COLORS.textMuted,
    fontSize: 8,
    textAlign: 'center',
  },
  check: {
    fontSize: 10,
    fontWeight: '900',
  },
});

const orientationStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  tile: {
    flex: 1,
    backgroundColor: COLORS.feltLight,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.boardBorder,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    minHeight: 80,
    justifyContent: 'center',
  },
  tileActive: {
    borderColor: COLORS.gold,
    borderWidth: 2,
  },
  tileIcon: {
    fontSize: 24,
  },
  tileLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tileLabelActive: {
    color: COLORS.gold,
  },
  check: {
    fontSize: 10,
    fontWeight: '900',
  },
});

const btnStyleStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  option: {
    flex: 1,
    backgroundColor: COLORS.feltLight,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.boardBorder,
    padding: 12,
    alignItems: 'center',
    gap: 6,
  },
  preview: {
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  check: {
    fontSize: 10,
    fontWeight: '900',
  },
});
