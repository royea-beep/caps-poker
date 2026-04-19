import React, { useState, useEffect } from 'react';
import { debugLog } from '../components/DebugOverlay';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Platform, Alert, Linking } from 'react-native';
import AvatarPicker from '../components/AvatarPicker';
import { rf, rs, rv, rb } from '../utils/responsive';
import { t } from '../utils/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TUTORIAL_SEEN_KEY } from '../components/Tutorial';
import { PRO_QUOTES_ENABLED_KEY, PRO_VOICES_ENABLED_KEY } from '../components/ProQuoteBanner';
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
import * as Updates from 'expo-updates';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import CardComponent from '../components/Card';
import { useGameStore } from '../store/gameStore';
import { DEFAULT_CONFIG, COLORS, GameConfig, getBoardCount } from '../constants/gameConfig';
import { CARD_THEMES, CardThemeId } from '../constants/cardThemes';
import { HOME_THEMES, HOME_THEME_NAMES, HomeThemeId, ButtonStyle } from '../constants/homeThemes';
import { FRIENDS_BGS, FriendsBgId } from '../constants/friendsBgs';
import { CapsHooks } from '../utils/learning';
import { OrientationType, VisualTheme } from '../store/gameStore';
import { getTheme, VISUAL_THEMES } from '../constants/visualThemes';
import { VersionBadge } from '../components/VersionBadge';

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

function ProfileSection() {
  const playerName = useGameStore((s) => s.playerName);
  const playerAvatar = useGameStore((s) => s.playerAvatar);
  const setPlayerName = useGameStore((s) => s.setPlayerName);
  const setPlayerAvatar = useGameStore((s) => s.setPlayerAvatar);
  const [pickerVisible, setPickerVisible] = useState(false);

  const displayName = playerName || 'Player 1';
  const displayAvatar = playerAvatar || '👤';

  return (
    <>
      <Pressable
        style={styles.profileRow}
        onPress={() => setPickerVisible(true)}
      >
        <Text style={styles.profileAvatar}>{displayAvatar}</Text>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileHint}>Shown on leaderboard · Tap to edit</Text>
        </View>
        <Text style={styles.profileEdit}>EDIT</Text>
      </Pressable>
      <AvatarPicker
        visible={pickerVisible}
        currentAvatar={displayAvatar}
        currentName={displayName}
        onSave={(avatar, name) => {
          setPlayerAvatar(avatar);
          setPlayerName(name.trim().slice(0, 20) || 'Player 1');
        }}
        onClose={() => setPickerVisible(false)}
      />
    </>
  );
}

function NotificationsToggle() {
  const enabled = useGameStore((s) => s.notificationsEnabled);
  const setEnabled = useGameStore((s) => s.setNotificationsEnabled);
  const [retrying, setRetrying] = useState(false);

  async function handleRetry() {
    setRetrying(true);
    try {
      const { retryPushRegistration } = await import('../utils/notifications');
      const ok = await retryPushRegistration();
      if (ok) setEnabled(true);
    } catch {}
    setRetrying(false);
  }

  return (
    <View>
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
      {!enabled && Platform.OS !== 'web' && (
        <Pressable
          style={styles.retryPushBtn}
          onPress={handleRetry}
          disabled={retrying}
        >
          <Text style={styles.retryPushText}>
            {retrying ? 'Registering…' : 'Enable Notifications'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function RevealSpeedSelector() {
  const value = useGameStore((s) => s.config.revealSpeed) ?? 'normal';
  const updateConfig = useGameStore((s) => s.updateConfig);
  const options: Array<{ key: 'fast' | 'normal' | 'cinematic'; label: string }> = [
    { key: 'fast', label: 'Fast' },
    { key: 'normal', label: 'Normal' },
    { key: 'cinematic', label: 'Cinematic' },
  ];
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowLabel}>Reveal Speed</Text>
      </View>
      <View style={styles.selectorRow}>
        {options.map((o) => (
          <Pressable
            key={o.key}
            onPress={() => { updateConfig({ revealSpeed: o.key }); CapsHooks.settingsChanged('revealSpeed', o.key); }}
            style={[styles.selectorBtn, value === o.key && styles.selectorBtnActive]}
          >
            <Text style={[styles.selectorText, value === o.key && styles.selectorTextActive]}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function SoundToggle() {
  const soundEnabled = useGameStore((s) => s.config.soundEnabled);
  const soundVolume = useGameStore((s) => s.config.soundVolume ?? 0.8);
  const updateConfig = useGameStore((s) => s.updateConfig);
  const STEPS = 10;
  const filled = Math.round(soundVolume * STEPS);

  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowLabel}>Sound Volume</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: rs(4) }}>
        <Pressable
          onPress={() => { updateConfig({ soundEnabled: !soundEnabled }); CapsHooks.settingsChanged('soundEnabled', !soundEnabled); }}
          style={[styles.toggleBtn, soundEnabled && styles.toggleBtnActive]}
        >
          <Text style={[styles.toggleText, soundEnabled && styles.toggleTextActive]}>
            {soundEnabled ? 'ON' : 'OFF'}
          </Text>
        </Pressable>
        {soundEnabled && (
          <View style={{ flexDirection: 'row', gap: rs(2), marginLeft: rs(6) }}>
            {Array.from({ length: STEPS }).map((_, i) => (
              <Pressable
                key={i}
                onPress={() => updateConfig({ soundVolume: (i + 1) / STEPS })}
                hitSlop={4}
              >
                <View style={[styles.volSegment, i < filled && styles.volSegmentFilled]} />
              </Pressable>
            ))}
            <Text style={styles.volPct}>{Math.round(soundVolume * 100)}%</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function AmbientToggle() {
  const [ambientEnabled, setAmbientEnabled] = useState(true);
  useEffect(() => {
    AsyncStorage.getItem('caps_ambient_enabled').then(v => {
      if (v === 'false') setAmbientEnabled(false);
    }).catch(() => {});
  }, []);
  const toggle = () => {
    const next = !ambientEnabled;
    setAmbientEnabled(next);
    AsyncStorage.setItem('caps_ambient_enabled', String(next)).catch(() => {});
  };
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowLabel}>Ambient Sound</Text>
        <Text style={styles.rowHint}>Casino background music</Text>
      </View>
      <Pressable onPress={toggle} style={[styles.toggleBtn, ambientEnabled && styles.toggleBtnActive]}>
        <Text style={[styles.toggleText, ambientEnabled && styles.toggleTextActive]}>
          {ambientEnabled ? 'ON' : 'OFF'}
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

  // C3: inline explanation per player count
  const modeHints: Record<number, string> = {
    2: '4 boards, 16 cards each',
    3: '3 boards, 12 cards each',
    4: '2 boards, 8 cards each',
  };

  return (
    <>
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
      <Text style={{ color: COLORS.gold, opacity: 0.7, fontSize: rf(11), textAlign: 'center', marginBottom: rs(4) }}>
        {modeHints[value]}
      </Text>
    </>
  );
}

function BotDifficultySelector() {
  const value = useGameStore((s) => s.config.botDifficulty) ?? 'easy';
  const updateConfig = useGameStore((s) => s.updateConfig);
  const options: Array<{ key: 'easy' | 'medium' | 'hard'; label: string; hint: string }> = [
    { key: 'easy',   label: 'Easy',   hint: 'Random placement' },
    { key: 'medium', label: 'Medium', hint: 'Groups suited cards' },
    { key: 'hard',   label: 'Hard',   hint: 'Pairs + suits + position' },
  ];
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowLabel}>Bot Difficulty</Text>
        <Text style={styles.rowHint}>{options.find(o => o.key === value)?.hint ?? ''}</Text>
      </View>
      <View style={styles.selectorRow}>
        {options.map((o) => (
          <Pressable
            key={o.key}
            onPress={() => { updateConfig({ botDifficulty: o.key }); CapsHooks.settingsChanged('botDifficulty', o.key); }}
            style={[styles.selectorBtn, value === o.key && styles.selectorBtnActive]}
          >
            <Text style={[styles.selectorText, value === o.key && styles.selectorTextActive]}>{o.label}</Text>
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


function ColorblindToggle() {
  const colorblindMode = useGameStore((s) => s.colorblindMode);
  const setColorblindMode = useGameStore((s) => s.setColorblindMode);
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowLabel}>Colorblind Mode</Text>
        <Text style={styles.rowHint}>{colorblindMode ? 'Blue = Win, Orange = Lose' : 'Green = Win, Red = Lose'}</Text>
      </View>
      <View style={styles.selectorRow}>
        <Pressable
          onPress={() => { hapticLight(); setColorblindMode(false); }}
          style={[styles.selectorBtn, !colorblindMode && styles.selectorBtnActive]}
        >
          <Text style={[styles.selectorText, !colorblindMode && styles.selectorTextActive]}>Off</Text>
        </Pressable>
        <Pressable
          onPress={() => { hapticLight(); setColorblindMode(true); }}
          style={[styles.selectorBtn, colorblindMode && styles.selectorBtnActive]}
        >
          <Text style={[styles.selectorText, colorblindMode && styles.selectorTextActive]}>On</Text>
        </Pressable>
      </View>
    </View>
  );
}

// C1: sample cards for hand sort preview
const SORT_PREVIEW_CARDS = [
  { rank: 'A', suit: '♠', isRed: false },
  { rank: 'K', suit: '♥', isRed: true },
  { rank: 'A', suit: '♦', isRed: true },
  { rank: 'J', suit: '♣', isRed: false },
];
// caps sort puts pairs (AA) first, then singles by suit
const SORT_PREVIEW_CAPS = [
  { rank: 'A', suit: '♠', isRed: false },
  { rank: 'A', suit: '♦', isRed: true },
  { rank: 'K', suit: '♥', isRed: true },
  { rank: 'J', suit: '♣', isRed: false },
];

function HandSortToggle() {
  const handSortMethod = useGameStore((s) => s.handSortMethod);
  const setHandSortMethod = useGameStore((s) => s.setHandSortMethod);

  const previewCards = handSortMethod === 'caps' ? SORT_PREVIEW_CAPS : SORT_PREVIEW_CARDS;

  return (
    <>
      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <Text style={styles.rowLabel}>Card Sort</Text>
          <Text style={styles.rowHint}>{handSortMethod === 'caps' ? 'Auto (Trips→Pairs→Suits)' : 'Pairs+Suits'}</Text>
        </View>
        <View style={styles.selectorRow}>
          <Pressable
            onPress={() => { hapticLight(); setHandSortMethod('caps'); }}
            style={[styles.selectorBtn, handSortMethod === 'caps' && styles.selectorBtnActive]}
          >
            <Text style={[styles.selectorText, handSortMethod === 'caps' && styles.selectorTextActive]}>Auto</Text>
          </Pressable>
          <Pressable
            onPress={() => { hapticLight(); setHandSortMethod('user'); }}
            style={[styles.selectorBtn, handSortMethod === 'user' && styles.selectorBtnActive]}
          >
            <Text style={[styles.selectorText, handSortMethod === 'user' && styles.selectorTextActive]}>Pairs</Text>
          </Pressable>
        </View>
      </View>
      {/* C1: hand sort preview */}
      <View style={{ flexDirection: 'row', gap: rs(6), justifyContent: 'center', marginBottom: rs(8) }}>
        {previewCards.map((c, i) => (
          <View key={i} style={{ backgroundColor: '#1a1a1a', borderRadius: rv(6), borderWidth: 1, borderColor: COLORS.boardBorder, paddingHorizontal: rs(7), paddingVertical: rs(4), alignItems: 'center', minWidth: rs(28) }}>
            <Text style={{ fontSize: rf(12), fontWeight: '900', color: c.isRed ? '#e53935' : '#f0dfc0' }}>{c.rank}</Text>
            <Text style={{ fontSize: rf(10), color: c.isRed ? '#e53935' : '#f0dfc0' }}>{c.suit}</Text>
          </View>
        ))}
      </View>
    </>
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

function VisualThemePicker() {
  const visualTheme = useGameStore((s) => s.visualTheme);
  const setVisualTheme = useGameStore((s) => s.setVisualTheme);
  const current = visualTheme ?? 'classic';

  const options: { id: VisualTheme; label: string; tag: string; bg: string; accent: string }[] = [
    { id: 'classic', label: 'CLASSIC', tag: 'Timeless', bg: '#1a0800', accent: '#c9a84c' },
    { id: 'fiveo',   label: 'FIVE-O',  tag: 'Arcade',   bg: '#5c0000', accent: '#FFD700' },
  ];

  return (
    <View style={vtStyles.container}>
      <Text style={vtStyles.sectionLabel}>🎨 VISUAL STYLE</Text>
      <View style={vtStyles.row}>
        {options.map((opt) => (
          <Pressable
            key={opt.id}
            style={[vtStyles.tile, current === opt.id && { borderColor: opt.accent, borderWidth: 2 }]}
            onPress={() => { hapticLight(); setVisualTheme(opt.id); }}
          >
            <View style={[vtStyles.preview, { backgroundColor: opt.bg, borderColor: opt.accent }]}>
              <Text style={[vtStyles.previewSymbol, { color: opt.accent }]}>♠</Text>
            </View>
            <Text style={[vtStyles.tileLabel, current === opt.id && { color: opt.accent }]}>{opt.label}</Text>
            <Text style={vtStyles.tileTag}>{opt.tag}</Text>
            {current === opt.id && <Text style={[vtStyles.check, { color: opt.accent }]}>✓</Text>}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const vtStyles = StyleSheet.create({
  container: {
    marginBottom: rs(24),
  },
  sectionLabel: {
    color: COLORS.textMuted,
    fontSize: rf(11),
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: rs(10),
  },
  row: {
    flexDirection: 'row',
    gap: rs(10),
  },
  tile: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: rv(12),
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
    padding: rs(12),
    alignItems: 'center',
    gap: rs(4),
  },
  preview: {
    width: rv(44),
    height: rv(36),
    borderRadius: rv(6),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: rs(4),
  },
  previewSymbol: {
    fontSize: rf(18),
    fontWeight: '900',
  },
  tileLabel: {
    color: COLORS.textPrimary,
    fontSize: rf(11),
    fontWeight: '900',
    letterSpacing: 1,
  },
  tileTag: {
    color: COLORS.textMuted,
    fontSize: rf(9),
    fontWeight: '600',
  },
  check: {
    fontSize: rf(12),
    fontWeight: '900',
  },
});

function ProQuotesToggle() {
  const [enabled, setEnabled] = useState(true);
  const [voicesEnabled, setVoicesEnabled] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(PRO_QUOTES_ENABLED_KEY).then(val => {
      setEnabled(val !== 'false');
    }).catch(() => {});
    AsyncStorage.getItem(PRO_VOICES_ENABLED_KEY).then(val => {
      setVoicesEnabled(val !== 'false');
    }).catch(() => {});
  }, []);

  const toggleQuotes = () => {
    const next = !enabled;
    setEnabled(next);
    AsyncStorage.setItem(PRO_QUOTES_ENABLED_KEY, next ? 'true' : 'false').catch(() => {});
    // If quotes OFF → voices also OFF
    if (!next) {
      setVoicesEnabled(false);
      AsyncStorage.setItem(PRO_VOICES_ENABLED_KEY, 'false').catch(() => {});
    }
  };

  const toggleVoices = () => {
    if (!enabled) return; // Can't enable voices without quotes
    const next = !voicesEnabled;
    setVoicesEnabled(next);
    AsyncStorage.setItem(PRO_VOICES_ENABLED_KEY, next ? 'true' : 'false').catch(() => {});
  };

  return (
    <>
      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <Text style={styles.rowLabel}>🎭 {t().proQuotes}</Text>
          <Text style={styles.rowHint}>Show fictional poker pro reactions</Text>
        </View>
        <Pressable onPress={toggleQuotes} style={[styles.toggleBtn, enabled && styles.toggleBtnActive]}>
          <Text style={[styles.toggleText, enabled && styles.toggleTextActive]}>{enabled ? 'ON' : 'OFF'}</Text>
        </Pressable>
      </View>
      <View style={[styles.row, !enabled && { opacity: 0.4 }]}>
        <View style={styles.rowLeft}>
          <Text style={styles.rowLabel}>🔊 {t().proVoice}</Text>
          <Text style={styles.rowHint}>Play AI voice clips with quotes</Text>
          <Text style={[styles.rowHint, { color: 'rgba(255,255,255,0.3)', fontSize: rf(9) }]}>⚠️ Not real player voices</Text>
        </View>
        <Pressable onPress={toggleVoices} style={[styles.toggleBtn, voicesEnabled && enabled && styles.toggleBtnActive]}>
          <Text style={[styles.toggleText, voicesEnabled && enabled && styles.toggleTextActive]}>{voicesEnabled && enabled ? 'ON' : 'OFF'}</Text>
        </Pressable>
      </View>
    </>
  );
}

// C2: Reset All Progress dialog
function ResetProgressButton() {
  const resetConfig = useGameStore((s) => s.resetConfig);

  const handleReset = () => {
    Alert.alert(
      'Reset All Progress',
      'This will delete all chips, level, history and streak. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            // Clear all known async storage keys
            const keys = [
              'caps-poker-storage',
              'colorblind_mode',
              'caps_ambient_enabled',
              'debug_overlay_enabled',
              'last_daily_reward_claim',
              'caps_hand_history',
            ];
            await AsyncStorage.multiRemove(keys).catch(() => {});
            resetConfig();
            Alert.alert('Progress Reset', 'All progress has been cleared. Restart the app to apply fully.');
          },
        },
      ]
    );
  };

  return (
    <Pressable
      onPress={handleReset}
      style={{ marginBottom: rs(12), paddingVertical: rs(12), borderRadius: rv(10), borderWidth: 1, borderColor: '#C62828', alignItems: 'center' }}
    >
      <Text style={{ color: '#C62828', fontSize: rf(13), fontWeight: '700' }}>Reset All Progress</Text>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const config = useGameStore((s) => s.config);
  const resetConfig = useGameStore((s) => s.resetConfig);
  const navigateToSimulation = () => router.push('/simulate');
  const [debugEnabled, setDebugEnabled] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('debug_overlay_enabled').then(v => {
      setDebugEnabled(v === 'true');
    }).catch(() => {});
  }, []);

  const boardCount = getBoardCount(config.numberOfPlayers);
  const buyIn = config.potPerBoard * boardCount;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>{t().settingsTitle}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <VisualThemePicker />
        <Text style={styles.sectionTitle}>📱 ORIENTATION</Text>
        <OrientationPicker />

        <Text style={styles.sectionTitle}>🖼️ BACKGROUND THEME</Text>
        <FriendsBgPicker />

        <Text style={styles.sectionTitle}>PROFILE</Text>
        <ProfileSection />

        <Text style={styles.sectionTitle}>GAMEPLAY</Text>
        <PlayerCountSelector />
        <BotDifficultySelector />
        <RevealSpeedSelector />
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
        <ColorblindToggle />
        <HandSortToggle />

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
        <AmbientToggle />
        <NotificationsToggle />

        <Text style={styles.sectionTitle}>TOOLS</Text>
        <ProQuotesToggle />
        <Button
          title={`📖 ${t().showTutorial}`}
          variant="secondary"
          onPress={() => {
            AsyncStorage.removeItem(TUTORIAL_SEEN_KEY).catch(() => {});
            Alert.alert('Tutorial Reset', 'Tutorial will show on next app launch.');
          }}
          style={{ marginBottom: 12 }}
        />
        <Button
          title="🃏 How to Play (Onboarding)"
          variant="secondary"
          onPress={async () => {
            await AsyncStorage.removeItem('hasSeenOnboarding').catch(() => {});
            router.replace('/');
          }}
          style={{ marginBottom: 12 }}
        />
        <Button title={t().simulationMode} variant="secondary" onPress={navigateToSimulation} style={{ marginBottom: 12 }} />
        {__DEV__ && (
          <>
            <Button
              title="🐛 Debug 1 Hand"
              variant="secondary"
              onPress={() => {
                debugLog('🤖 AUTO-SIM: 1 hand');
                router.push('/game?autoSim=true&autoSimCount=1&currentSimHand=1' as any);
              }}
              style={{ marginBottom: 8, borderColor: '#00ff00', opacity: 0.7 }}
            />
            <Button
              title="🐛 Debug Marathon (10 hands)"
              variant="secondary"
              onPress={() => {
                debugLog('🤖 AUTO-SIM: 10-hand marathon');
                router.push('/game?autoSim=true&autoSimCount=10&currentSimHand=1' as any);
              }}
              style={{ marginBottom: 12, borderColor: '#00ff00', opacity: 0.7 }}
            />
            <Button
              title="🔬 Auto-Debug Suite"
              variant="secondary"
              onPress={() => router.push('/debug' as any)}
              style={{ marginBottom: 12, borderColor: '#ff9900', opacity: 0.8 }}
            />
          </>
        )}

        <Text style={styles.sectionTitle}>DEVELOPER</Text>
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowLabel}>{t().debugOverlay}</Text>
            <Text style={styles.rowHint}>Restart app to apply</Text>
          </View>
          <Pressable
            onPress={() => {
              const next = !debugEnabled;
              setDebugEnabled(next);
              AsyncStorage.setItem('debug_overlay_enabled', next ? 'true' : 'false').catch(() => {});
            }}
            style={[styles.toggleBtn, debugEnabled && styles.toggleBtnActive]}
          >
            <Text style={[styles.toggleText, debugEnabled && styles.toggleTextActive]}>
              {debugEnabled ? 'ON' : 'OFF'}
            </Text>
          </Pressable>
        </View>

        <Button
          title={t().resetDefaults}
          variant="secondary"
          onPress={resetConfig}
          style={{ marginBottom: 24 }}
        />

        <Text style={styles.sectionTitle}>DANGER ZONE</Text>
        <ResetProgressButton />

        <Text style={styles.sectionTitle}>CREDITS</Text>
        <View style={styles.creditsBox}>
          <Text style={styles.creditsText}>🤖 Pro Quotes: AI digital simulation — fictional quotes</Text>
          <Text style={styles.creditsText}>🔊 Voice Clips: AI-generated voices via ElevenLabs</Text>
          <Text style={styles.creditsText}>⚠️ Not affiliated with any poker player mentioned</Text>
          <Text style={styles.creditsText}>Voices are parody / entertainment only</Text>
        </View>
        <Pressable
          onPress={() => router.push('/rank' as any)}
          style={styles.privacyLink}
        >
          <Text style={styles.privacyLinkText}>🏆 Your Rank</Text>
        </Pressable>
        <Pressable
          onPress={() => Linking.openURL('https://caps.ftable.co.il/privacy')}
          style={styles.privacyLink}
        >
          <Text style={styles.privacyLinkText}>Privacy Policy</Text>
        </Pressable>

        <View style={{ alignItems: 'center', paddingBottom: 8 }}>
          <VersionBadge />
          <Text style={{ color: '#555', fontSize: rf(11), marginTop: 4 }}>
            OTA: {Updates.updateId?.slice(0, 8) ?? 'none'} | Ch: {Updates.channel ?? '?'} | RT: {Updates.runtimeVersion ?? '?'}
          </Text>
          <Text style={{ color: '#555', fontSize: rf(11), marginTop: 2 }}>
            Embedded: {Updates.isEmbeddedLaunch ? 'YES' : 'NO'} | {Updates.createdAt?.toISOString().slice(0, 10) ?? 'unknown'}
          </Text>
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
    paddingHorizontal: rs(16),
    paddingVertical: rs(12),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.boardBorder,
  },
  backButton: {
    padding: rs(4),
  },
  backText: {
    color: COLORS.textSecondary,
    fontSize: rf(15),
  },
  title: {
    color: COLORS.goldBright,
    fontSize: rf(18),
    fontWeight: '900',
    letterSpacing: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: rs(16),
    gap: rs(4),
  },
  sectionTitle: {
    color: COLORS.gold,
    fontSize: rf(12),
    fontWeight: '800',
    letterSpacing: 3,
    marginTop: rs(20),
    marginBottom: rs(8),
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.feltLight,
    padding: rs(12),
    borderRadius: rv(8),
    marginBottom: rs(6),
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
  },
  rowLeft: {
    flex: 1,
  },
  // Profile section
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(12),
    backgroundColor: COLORS.surface,
    borderRadius: rv(10),
    padding: rs(12),
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
    ...Platform.select({ web: { cursor: 'pointer' } as any }),
  },
  profileAvatar: {
    fontSize: rf(32),
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: rf(15),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  profileHint: {
    fontSize: rf(11),
    color: COLORS.textDim,
    marginTop: rs(2),
  },
  profileEdit: {
    fontSize: rf(11),
    fontWeight: '800',
    color: COLORS.gold,
    letterSpacing: 1,
  },
  rowLabel: {
    color: COLORS.textPrimary,
    fontSize: rf(14),
    fontWeight: '600',
  },
  rowHint: {
    color: COLORS.textSecondary,
    fontSize: rf(10),
    marginTop: rs(2),
  },
  creditsBox: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: rv(8),
    padding: rs(12),
    marginBottom: rs(24),
    gap: rs(4),
  },
  creditsText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: rf(10),
    lineHeight: rf(16),
  },
  rowError: {
    color: COLORS.danger,
    fontSize: rf(10),
    fontWeight: '600',
    marginTop: rs(2),
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(6),
  },
  input: {
    backgroundColor: COLORS.background,
    color: COLORS.goldBright,
    fontSize: rf(16),
    fontWeight: '700',
    paddingHorizontal: rs(12),
    paddingVertical: rs(6),
    borderRadius: rv(6),
    minWidth: rv(70),
    textAlign: 'center',
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
  },
  inputError: {
    borderColor: COLORS.danger,
  },
  suffix: {
    color: COLORS.textSecondary,
    fontSize: rf(12),
    fontWeight: '600',
  },
  selectorRow: {
    flexDirection: 'row',
    gap: rs(6),
  },
  selectorBtn: {
    width: rv(40),
    height: rb(36),
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: rv(6),
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
    fontSize: rf(16),
    fontWeight: '700',
  },
  selectorTextActive: {
    color: COLORS.background,
  },
  toggleBtn: {
    paddingHorizontal: rs(16),
    paddingVertical: rs(8),
    borderRadius: rv(6),
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
    fontSize: rf(14),
    fontWeight: '700',
  },
  toggleTextActive: {
    color: COLORS.background,
  },
  retryPushBtn: {
    marginHorizontal: rs(16),
    marginTop: rs(6),
    marginBottom: rs(4),
    paddingVertical: rs(8),
    paddingHorizontal: rs(16),
    borderRadius: rs(8),
    borderWidth: 1,
    borderColor: '#c9a84c',
    alignItems: 'center',
  },
  retryPushText: {
    color: '#c9a84c',
    fontSize: rf(13),
    fontWeight: '700',
  },
  // S116: volume segments
  volSegment: {
    width: rs(10),
    height: rs(18),
    borderRadius: rs(2),
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  volSegmentFilled: {
    backgroundColor: '#c9a84c',
  },
  volPct: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: rf(10),
    fontWeight: '600',
    marginLeft: rs(4),
    minWidth: rs(30),
    textAlign: 'right',
  },
  // S116: Privacy Policy
  privacyLink: {
    alignSelf: 'center',
    paddingVertical: rs(12),
    marginTop: rs(8),
  },
  privacyLinkText: {
    fontSize: rf(12),
    color: 'rgba(201,168,76,0.5)',
    textDecorationLine: 'underline',
  },
});

const themeStyles = StyleSheet.create({
  pickerRow: {
    flexDirection: 'row',
    gap: rs(8),
    marginBottom: rs(6),
  },
  themeBtn: {
    flex: 1,
    backgroundColor: COLORS.feltLight,
    borderRadius: rv(10),
    borderWidth: 1.5,
    borderColor: COLORS.boardBorder,
    padding: rs(10),
    alignItems: 'center',
    gap: rs(8),
  },
  themeBtnActive: {
    borderColor: COLORS.gold,
    borderWidth: 2,
  },
  themeBtnLabel: {
    color: COLORS.textSecondary,
    fontSize: rf(10),
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  themeBtnLabelActive: {
    color: COLORS.gold,
  },
  previewRow: {
    flexDirection: 'row',
    gap: rs(3),
    justifyContent: 'center',
  },
  activePill: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: rs(8),
    paddingVertical: rs(2),
    borderRadius: rv(6),
  },
  activePillText: {
    color: COLORS.background,
    fontSize: rf(9),
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});

const homeThemeStyles = StyleSheet.create({
  container: {
    gap: rs(8),
    marginBottom: rs(6),
  },
  swatchRow: {
    flexDirection: 'row',
    gap: rs(8),
  },
  swatchItem: {
    flex: 1,
    alignItems: 'center',
    gap: rs(4),
  },
  swatchCircle: {
    width: rv(40),
    height: rv(40),
    borderRadius: rv(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchCircleActive: {
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  swatchCheck: {
    fontSize: rf(16),
    fontWeight: '900',
    color: '#000000',
  },
  swatchLabel: {
    fontSize: rf(9),
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
});

const bgPickerStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: rs(8),
    marginBottom: rs(6),
  },
  tile: {
    flex: 1,
    backgroundColor: COLORS.feltLight,
    borderRadius: rv(10),
    borderWidth: 1.5,
    borderColor: COLORS.boardBorder,
    padding: rs(10),
    alignItems: 'center',
    gap: rs(4),
    minHeight: rb(80),
    justifyContent: 'center',
  },
  tileActive: {
    borderColor: COLORS.gold,
    borderWidth: 2,
  },
  noPreview: {
    width: rv(48),
    height: rv(28),
  },
  tileLabel: {
    color: COLORS.textSecondary,
    fontSize: rf(10),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tileLabelActive: {
    color: COLORS.gold,
  },
  tileHint: {
    color: COLORS.textMuted,
    fontSize: rf(8),
    textAlign: 'center',
  },
  check: {
    fontSize: rf(10),
    fontWeight: '900',
  },
});

const orientationStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: rs(8),
    marginBottom: rs(6),
  },
  tile: {
    flex: 1,
    backgroundColor: COLORS.feltLight,
    borderRadius: rv(10),
    borderWidth: 1.5,
    borderColor: COLORS.boardBorder,
    padding: rs(14),
    alignItems: 'center',
    gap: rs(6),
    minHeight: rb(80),
    justifyContent: 'center',
  },
  tileActive: {
    borderColor: COLORS.gold,
    borderWidth: 2,
  },
  tileIcon: {
    fontSize: rf(24),
  },
  tileLabel: {
    color: COLORS.textSecondary,
    fontSize: rf(11),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tileLabelActive: {
    color: COLORS.gold,
  },
  check: {
    fontSize: rf(10),
    fontWeight: '900',
  },
});

const btnStyleStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: rs(8),
    marginBottom: rs(6),
  },
  option: {
    flex: 1,
    backgroundColor: COLORS.feltLight,
    borderRadius: rv(10),
    borderWidth: 1.5,
    borderColor: COLORS.boardBorder,
    padding: rs(12),
    alignItems: 'center',
    gap: rs(6),
  },
  preview: {
    borderRadius: rv(8),
    paddingVertical: rs(6),
    paddingHorizontal: rs(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewText: {
    fontSize: rf(11),
    fontWeight: '800',
    letterSpacing: 1,
  },
  label: {
    fontSize: rf(10),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  check: {
    fontSize: rf(10),
    fontWeight: '900',
  },
});
