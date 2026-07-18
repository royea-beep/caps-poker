import React, { useState, useEffect } from 'react';
import { debugLog } from '../components/DebugOverlay';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Platform, Alert, Linking, Switch } from 'react-native';
import Constants from 'expo-constants';
import AvatarPicker from '../components/AvatarPicker';
import { rf, rs, rv, rb } from '../utils/responsive';
import { t } from '../utils/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { INTERACTIVE_TUTORIAL_KEY } from '../components/InteractiveTutorial';
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
import { getSupabase } from '../utils/supabase';
import { getDeviceId } from '../utils/leaderboard';
import { getAuthState, logout } from '../utils/auth';
import { track } from '../utils/analytics';
import { OrientationType, VisualTheme } from '../store/gameStore';
import { getTheme, VISUAL_THEMES } from '../constants/visualThemes';
import { VersionBadge } from '../components/VersionBadge';
import ReportBugButton from '../components/ReportBugButton';

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
          accessibilityLabel={label}
          accessibilityHint={suffix ? `Value in ${suffix}` : undefined}
        />
        {suffix && <Text style={styles.suffix}>{suffix}</Text>}
      </View>
    </View>
  );
}

/**
 * VAMOS UX-BATCH-2 (Item 1) — collapsed home for the raw dev-tuning knobs that used to
 * sit on the Settings front page (TIMING + BOT sections). Default collapsed; Iron Rule 3
 * stays satisfied — every parameter remains runtime-configurable, just one tap deeper.
 */
function AdvancedSection() {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        onPress={() => { hapticLight(); setOpen((o) => !o); }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Advanced tuning, ${open ? 'expanded' : 'collapsed'}`}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}
      >
        <Text style={styles.sectionTitle} accessibilityRole="header">⚙️ ADVANCED</Text>
        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: rf(16), fontWeight: '700' }}>{open ? '▾' : '▸'}</Text>
      </Pressable>
      {open && (
        <>
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: rf(11), marginBottom: rs(8) }}>
            Raw gameplay tuning — the defaults are right for normal play.
          </Text>
          <SettingRow label="Arrangement Time" configKey="arrangementTime" suffix="sec" min={10} />
          <SettingRow label="Board Reveal Duration" configKey="boardRevealDuration" suffix="sec" min={1} />
          <SettingRow label="Card Flip Speed" configKey="turnRevealDelay" suffix="ms" min={100} />
          <SettingRow label="Complete Bonus Display" configKey="completeBonusDisplay" suffix="sec" min={1} />
          <SettingRow label="Bot Speed Min" configKey="botSpeedMin" suffix="ms" min={0} />
          <SettingRow label="Bot Speed Max" configKey="botSpeedMax" suffix="ms" min={0} />
        </>
      )}
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
        accessibilityRole="button"
        accessibilityLabel={`Profile: ${displayName}`}
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
          accessibilityRole="switch"
          accessibilityLabel="Push notifications"
          accessibilityState={{ checked: enabled }} aria-checked={enabled}
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
          accessibilityRole="button"
          accessibilityLabel="Enable notifications"
          accessibilityLiveRegion="polite"
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
      <View style={styles.selectorRow} accessibilityRole="radiogroup" accessibilityLabel="Reveal speed">
        {options.map((o) => (
          <Pressable
            key={o.key}
            onPress={() => { updateConfig({ revealSpeed: o.key }); CapsHooks.settingsChanged('revealSpeed', o.key); }}
            style={[styles.selectorBtn, value === o.key && styles.selectorBtnActive]}
            accessibilityRole="radio"
            accessibilityLabel={`Reveal speed ${o.label}`}
            accessibilityState={{ checked: value === o.key }} aria-checked={value === o.key}
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
          accessibilityRole="switch"
          accessibilityLabel="Sound enabled"
          accessibilityState={{ checked: soundEnabled }} aria-checked={soundEnabled}
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
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={`Volume ${(i + 1) * 10} percent`}
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
      <Pressable onPress={toggle} style={[styles.toggleBtn, ambientEnabled && styles.toggleBtnActive]} accessibilityRole="switch" accessibilityLabel="Ambient sound" accessibilityState={{ checked: ambientEnabled }} aria-checked={ambientEnabled}>
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
        <View style={styles.selectorRow} accessibilityRole="radiogroup" accessibilityLabel="Number of players">
          {([2, 3, 4] as const).map((n) => (
            <Pressable
              key={n}
              onPress={() => { updateConfig({ numberOfPlayers: n }); CapsHooks.settingsChanged('numberOfPlayers', n); }}
              style={[styles.selectorBtn, value === n && styles.selectorBtnActive]}
              accessibilityRole="radio"
              accessibilityLabel={`${n} players`}
              accessibilityState={{ checked: value === n }} aria-checked={value === n}
            >
              <Text style={[styles.selectorText, value === n && styles.selectorTextActive]}>
                {n}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Text style={{ color: COLORS.mint, opacity: 0.7, fontSize: rf(11), textAlign: 'center', marginBottom: rs(4) }}>
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
      <View style={styles.selectorRow} accessibilityRole="radiogroup" accessibilityLabel="Bot difficulty">
        {options.map((o) => (
          <Pressable
            key={o.key}
            onPress={() => { updateConfig({ botDifficulty: o.key }); CapsHooks.settingsChanged('botDifficulty', o.key); }}
            style={[styles.selectorBtn, value === o.key && styles.selectorBtnActive]}
            accessibilityRole="radio"
            accessibilityLabel={`Bot difficulty ${o.label}`}
            accessibilityState={{ checked: value === o.key }} aria-checked={value === o.key}
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
            accessibilityRole="radio"
            accessibilityLabel={`Orientation ${label}`}
            accessibilityState={{ checked: active }} aria-checked={active}
          >
            <Text style={orientationStyles.tileIcon}>{icon}</Text>
            <Text style={[orientationStyles.tileLabel, active && orientationStyles.tileLabelActive]}>{label}</Text>
            {active && <Text aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[orientationStyles.check, { color: COLORS.mint }]}>✓</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * VAMOS S-BATCH — "Skip board-by-board reveal" (instant results). Unlocked after 3
 * completed games (reveal stays the default teaching flow for new players); OFF by default.
 */
function SkipRevealToggle() {
  const skip = useGameStore((s) => s.skipBoardReveal);
  const setSkip = useGameStore((s) => s.setSkipBoardReveal);
  const [unlocked, setUnlocked] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem('caps_games_played')
      .then((v) => { if (parseInt(v ?? '0', 10) >= 3) setUnlocked(true); })
      .catch(() => {});
  }, []);
  if (!unlocked) return null;
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowLabel}>Skip board-by-board reveal</Text>
        <Text style={styles.rowHint}>{skip ? 'Instant results summary' : 'Reveal each board (default)'}</Text>
      </View>
      <View style={styles.selectorRow} accessibilityRole="radiogroup" accessibilityLabel="Skip board reveal">
        <Pressable
          onPress={() => { hapticLight(); setSkip(false); }}
          style={[styles.selectorBtn, !skip && styles.selectorBtnActive]}
          accessibilityRole="radio"
          accessibilityLabel="Reveal each board"
          accessibilityState={{ checked: !skip }} aria-checked={!skip}
        >
          <Text style={[styles.selectorText, !skip && styles.selectorTextActive]}>OFF</Text>
        </Pressable>
        <Pressable
          onPress={() => { hapticLight(); setSkip(true); }}
          style={[styles.selectorBtn, skip && styles.selectorBtnActive]}
          accessibilityRole="radio"
          accessibilityLabel="Skip to instant results"
          accessibilityState={{ checked: skip }} aria-checked={skip}
        >
          <Text style={[styles.selectorText, skip && styles.selectorTextActive]}>ON</Text>
        </Pressable>
      </View>
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
      <View style={styles.selectorRow} accessibilityRole="radiogroup" accessibilityLabel="Four color suits">
        <Pressable
          onPress={() => { hapticLight(); setFourColorSuits(false); }}
          style={[styles.selectorBtn, !fourColorSuits && styles.selectorBtnActive]}
          accessibilityRole="radio"
          accessibilityLabel="2-color suits"
          accessibilityState={{ checked: !fourColorSuits }} aria-checked={!fourColorSuits}
        >
          <Text style={[styles.selectorText, !fourColorSuits && styles.selectorTextActive]}>2</Text>
        </Pressable>
        <Pressable
          onPress={() => { hapticLight(); setFourColorSuits(true); }}
          style={[styles.selectorBtn, fourColorSuits && styles.selectorBtnActive]}
          accessibilityRole="radio"
          accessibilityLabel="4-color suits"
          accessibilityState={{ checked: fourColorSuits }} aria-checked={fourColorSuits}
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
      <View style={styles.selectorRow} accessibilityRole="radiogroup" accessibilityLabel="Colorblind mode">
        <Pressable
          onPress={() => { hapticLight(); setColorblindMode(false); }}
          style={[styles.selectorBtn, !colorblindMode && styles.selectorBtnActive]}
          accessibilityRole="radio"
          accessibilityLabel="Colorblind mode off"
          accessibilityState={{ checked: !colorblindMode }} aria-checked={!colorblindMode}
        >
          <Text style={[styles.selectorText, !colorblindMode && styles.selectorTextActive]}>Off</Text>
        </Pressable>
        <Pressable
          onPress={() => { hapticLight(); setColorblindMode(true); }}
          style={[styles.selectorBtn, colorblindMode && styles.selectorBtnActive]}
          accessibilityRole="radio"
          accessibilityLabel="Colorblind mode on"
          accessibilityState={{ checked: colorblindMode }} aria-checked={colorblindMode}
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
        <View style={styles.selectorRow} accessibilityRole="radiogroup" accessibilityLabel="Hand sort">
          <Pressable
            onPress={() => { hapticLight(); setHandSortMethod('caps'); }}
            style={[styles.selectorBtn, handSortMethod === 'caps' && styles.selectorBtnActive]}
            accessibilityRole="radio"
            accessibilityLabel="Card sort auto"
            accessibilityState={{ checked: handSortMethod === 'caps' }} aria-checked={handSortMethod === 'caps'}
          >
            <Text style={[styles.selectorText, handSortMethod === 'caps' && styles.selectorTextActive]}>Auto</Text>
          </Pressable>
          <Pressable
            onPress={() => { hapticLight(); setHandSortMethod('user'); }}
            style={[styles.selectorBtn, handSortMethod === 'user' && styles.selectorBtnActive]}
            accessibilityRole="radio"
            accessibilityLabel="Card sort pairs"
            accessibilityState={{ checked: handSortMethod === 'user' }} aria-checked={handSortMethod === 'user'}
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
    <View style={themeStyles.pickerRow} accessibilityRole="radiogroup" accessibilityLabel="Card theme">
      {(['v1', 'v2', 'v3'] as CardThemeId[]).map((id) => {
        const t = CARD_THEMES[id];
        const active = cardTheme === id;
        return (
          <Pressable
            key={id}
            onPress={() => { hapticLight(); setCardTheme(id); }}
            style={[themeStyles.themeBtn, active && themeStyles.themeBtnActive]}
            accessibilityRole="radio"
            accessibilityLabel={`Card theme ${t.name}`}
            accessibilityState={{ checked: active }} aria-checked={active}
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
                <Text style={themeStyles.activePillText}>
                  <Text aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">✓ </Text>
                  Active
                </Text>
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
    <View style={homeThemeStyles.container} accessibilityRole="radiogroup" accessibilityLabel="Home theme">
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
                accessibilityRole="radio"
                accessibilityLabel={`Home theme ${HOME_THEME_NAMES[id]}`}
                accessibilityState={{ checked: active }} aria-checked={active}
              >
                <View
                  style={[
                    homeThemeStyles.swatchCircle,
                    { backgroundColor: t.accent },
                    active && homeThemeStyles.swatchCircleActive,
                  ]}
                >
                  {active && <Text aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={homeThemeStyles.swatchCheck}>✓</Text>}
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
    <View style={btnStyleStyles.row} accessibilityRole="radiogroup" accessibilityLabel="Button style">
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
            accessibilityRole="radio"
            accessibilityLabel={`Button style ${label}`}
            accessibilityState={{ checked: active }} aria-checked={active}
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
            {active && <Text aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[btnStyleStyles.check, { color: t.accent }]}>✓</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

const BG_OPTIONS: { id: FriendsBgId; label: string; hint: string }[] = [
  { id: 'none', label: 'None', hint: 'No bg' },
  { id: 'sofa', label: 'Felt', hint: 'Green table' },
  { id: 'logo', label: 'Neon', hint: 'Casino sign' },
  { id: 'fountain', label: 'Vegas', hint: 'Strip lights' },
];

function FriendsBgPicker() {
  const friendsBg = useGameStore((s) => s.friendsBg ?? 'none');
  const setFriendsBg = useGameStore((s) => s.setFriendsBg);

  return (
    <View style={bgPickerStyles.row} accessibilityRole="radiogroup" accessibilityLabel="Friends background">
      {BG_OPTIONS.map(({ id, label, hint }) => {
        const active = friendsBg === id;
        const entry = id !== 'none' ? FRIENDS_BGS[id as Exclude<FriendsBgId, 'none'>] : null;
        return (
          <Pressable
            key={id}
            onPress={() => { hapticLight(); setFriendsBg(id); }}
            style={[bgPickerStyles.tile, active && bgPickerStyles.tileActive]}
            accessibilityRole="radio"
            accessibilityLabel={`Background ${label}`}
            accessibilityState={{ checked: active }} aria-checked={active}
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
            {active && <Text aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[bgPickerStyles.check, { color: COLORS.mint }]}>✓</Text>}
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
      <Text style={vtStyles.sectionLabel} accessibilityRole="header">
        <Text aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">🎨 </Text>
        VISUAL STYLE
      </Text>
      <View style={vtStyles.row} accessibilityRole="radiogroup" accessibilityLabel="Visual theme">
        {options.map((opt) => (
          <Pressable
            key={opt.id}
            style={[vtStyles.tile, current === opt.id && { borderColor: opt.accent, borderWidth: 2 }]}
            onPress={() => { hapticLight(); setVisualTheme(opt.id); }}
            accessibilityRole="radio"
            accessibilityLabel={`Visual style ${opt.label}`}
            accessibilityState={{ checked: current === opt.id }} aria-checked={current === opt.id}
          >
            <View style={[vtStyles.preview, { backgroundColor: opt.bg, borderColor: opt.accent }]}>
              <Text style={[vtStyles.previewSymbol, { color: opt.accent }]}>♠</Text>
            </View>
            <Text style={[vtStyles.tileLabel, current === opt.id && { color: opt.accent }]}>{opt.label}</Text>
            <Text style={vtStyles.tileTag}>{opt.tag}</Text>
            {current === opt.id && <Text aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[vtStyles.check, { color: opt.accent }]}>✓</Text>}
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
          <Text style={styles.rowLabel}>
            <Text aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">🎭 </Text>
            {t().proQuotes}
          </Text>
          <Text style={styles.rowHint}>Show fictional poker pro reactions</Text>
        </View>
        <Pressable onPress={toggleQuotes} style={[styles.toggleBtn, enabled && styles.toggleBtnActive]} accessibilityRole="switch" accessibilityLabel="Pro quotes" accessibilityState={{ checked: enabled }} aria-checked={enabled}>
          <Text style={[styles.toggleText, enabled && styles.toggleTextActive]}>{enabled ? 'ON' : 'OFF'}</Text>
        </Pressable>
      </View>
      <View style={[styles.row, !enabled && { opacity: 0.4 }]}>
        <View style={styles.rowLeft}>
          <Text style={styles.rowLabel}>
            <Text aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">🔊 </Text>
            {t().proVoice}
          </Text>
          <Text style={styles.rowHint}>Play AI voice clips with quotes</Text>
          <Text style={[styles.rowHint, { color: 'rgba(255,255,255,0.7)', fontSize: rf(9) }]}>
            <Text aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">⚠️ </Text>
            Not real player voices
          </Text>
        </View>
        <Pressable onPress={toggleVoices} style={[styles.toggleBtn, voicesEnabled && enabled && styles.toggleBtnActive]} accessibilityRole="switch" accessibilityLabel="Pro voices" accessibilityState={{ checked: voicesEnabled && enabled, disabled: !enabled }} aria-checked={voicesEnabled && enabled} aria-disabled={!enabled}>
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
      style={{ marginBottom: rs(12), paddingVertical: rs(12), borderRadius: rv(10), borderWidth: 1, borderColor: '#C62828', alignItems: 'center', minHeight: 44 }}
      accessibilityRole="button"
      accessibilityLabel="Reset all progress"
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

  const handleDeleteAccount = async () => {
    track('account_deletion_pressed', {}, 'settings');
    const firstConfirm = Platform.OS === 'web'
      ? window.confirm('Are you sure you want to delete your account? All data will be permanently erased.')
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Delete Account',
            'Are you sure? All your data will be permanently erased:\n\n• Chips and daily streak\n• Hand history\n• Achievements and cups\n• Profile and rank',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Yes, delete everything', style: 'destructive', onPress: () => resolve(true) },
            ],
          );
        });
    if (!firstConfirm) { track('account_deletion_cancelled', {}, 'settings'); return; }

    const secondConfirm = Platform.OS === 'web'
      ? window.confirm('This action is irreversible. Delete?')
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Final confirmation',
            'This action is irreversible. All data will be erased and cannot be recovered.',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Delete permanently', style: 'destructive', onPress: () => resolve(true) },
            ],
          );
        });
    if (!secondConfirm) { track('account_deletion_cancelled', {}, 'settings'); return; }

    track('account_deletion_confirmed', {}, 'settings');
    try {
      const sb = getSupabase();
      const deviceId = await getDeviceId();
      const authState = await getAuthState();
      const { data, error } = await sb!.rpc('delete_user_account', {
        p_device_id: deviceId,
        p_user_id: authState.userId,
      });
      if (error) {
        Alert.alert('Error', 'We could not delete your account. Please try again later.');
        track('account_deletion_failed', { error: error.message }, 'settings');
        return;
      }
      await AsyncStorage.clear();
      await logout();
      track('account_deleted', { tables: (data as any)?.tables_affected }, 'settings');
      if (Platform.OS === 'web') {
        window.location.href = '/';
      } else {
        router.replace('/');
      }
    } catch (e: any) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
      track('account_deletion_error', { error: e?.message }, 'settings');
    }
  };
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [muteQuotes, setMuteQuotes] = useState(false);
  const isBeta = Constants.expoConfig?.extra?.isBeta === true;
  // FIT-ALL-BOARDS 2026-06-09 — Settings-controlled max board card height.
  // Stored in AsyncStorage under 'max_board_card_h_dp' in dp at base 393x852.
  // Range [50, 100], default 70. Stepper UI below adjusts in 5-dp increments.
  const BOARD_CAP_DEFAULT = 70;
  const BOARD_CAP_MIN = 50;
  const BOARD_CAP_MAX = 100;
  const BOARD_CAP_STEP = 5;
  const [boardCardCap, setBoardCardCap] = useState<number>(BOARD_CAP_DEFAULT);

  useEffect(() => {
    AsyncStorage.getItem('debug_overlay_enabled').then(v => {
      setDebugEnabled(v === 'true');
    }).catch(() => {});
    AsyncStorage.getItem('caps_beta_mute_quotes').then(v => setMuteQuotes(v === 'true')).catch(() => {});
    AsyncStorage.getItem('max_board_card_h_dp').then(v => {
      const n = v ? parseFloat(v) : NaN;
      if (Number.isFinite(n) && n >= BOARD_CAP_MIN && n <= BOARD_CAP_MAX) {
        setBoardCardCap(n);
      }
    }).catch(() => {});
  }, []);

  const applyBoardCardCap = (next: number) => {
    const clamped = Math.max(BOARD_CAP_MIN, Math.min(BOARD_CAP_MAX, next));
    setBoardCardCap(clamped);
    AsyncStorage.setItem('max_board_card_h_dp', String(clamped)).catch(() => {});
  };

  const boardCount = getBoardCount(config.numberOfPlayers);
  const buyIn = config.potPerBoard * boardCount;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel="Go back">
          <Text style={styles.backText}>
            <Text aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">← </Text>
            Back
          </Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">{t().settingsTitle}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <VisualThemePicker />
        {/* VAMOS-POLISH 2026-06-17 — ORIENTATION section removed. The app is
            portrait-only (Iron Rule #2); the prior section offered Portrait /
            Widescreen which violated the rule. */}

        <Text style={styles.sectionTitle} accessibilityRole="header" accessibilityLabel="BACKGROUND THEME">🖼️ BACKGROUND THEME</Text>
        <FriendsBgPicker />

        <Text style={styles.sectionTitle} accessibilityRole="header">PROFILE</Text>
        <ProfileSection />

        <Text style={styles.sectionTitle} accessibilityRole="header">GAMEPLAY</Text>
        <PlayerCountSelector />
        {/* VAMOS-POLISH 2026-06-17 — BotDifficultySelector hidden. Bot uses
            random placement only (Iron Rule #5); the Easy/Medium/Hard selector
            was dead UI. The botDifficulty config field stays in the store for
            analytics/telemetry compatibility but is no longer user-facing. */}
        <RevealSpeedSelector />
        <SkipRevealToggle />
        <SettingRow label="Starting Chips" configKey="startingChips" min={1} />
        <SettingRow label="Pot Per Board" configKey="potPerBoard" suffix={`× ${boardCount} boards = ${buyIn}`} min={1} />
        <SettingRow label="Complete Bonus %" configKey="completeBonusPercent" suffix="% of buy-in" min={0} max={100} />

        <Text style={styles.sectionTitle} accessibilityRole="header" accessibilityLabel="HOME THEME">🏠 HOME THEME</Text>
        <HomeThemePicker />

        <Text style={styles.sectionTitle} accessibilityRole="header">
          <Text aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">🎨 </Text>
          BUTTON STYLE
        </Text>
        <ButtonStylePicker />

        <Text style={styles.sectionTitle} accessibilityRole="header" accessibilityLabel="Card design">🃏 CARD DESIGN</Text>
        <CardThemePicker />
        <FourColorSuitsToggle />
        <ColorblindToggle />
        <HandSortToggle />

        {/* VAMOS UX-BATCH-2 (Item 1) — TIMING + BOT raw tuning knobs moved into the
            collapsed ADVANCED section at the bottom. Iron Rule 3 stays satisfied:
            everything is still runtime-configurable, just not on the front page. */}

        <Text style={styles.sectionTitle} accessibilityRole="header">AUDIO & NOTIFICATIONS</Text>
        <SoundToggle />
        <AmbientToggle />
        <NotificationsToggle />

        <Text style={styles.sectionTitle} accessibilityRole="header">TOOLS</Text>
        {/* Discoverable bug-report entry for testers — writes to bug_reports (AI triage +
            Telegram/GitHub fire via the on_bug_report_inserted trigger). */}
        <View style={{ marginBottom: 12 }}>
          <ReportBugButton variant="row" />
        </View>
        <ProQuotesToggle />
        {/* DEDUPE-QA: a single replay for the one onboarding (InteractiveTutorial). The old
            "show tutorial" (static Tutorial) + "How to Play (Onboarding)" (OnboardingOverlay)
            buttons were removed along with those flows. */}
        <Button
          title={`📖 ${t().showTutorial}`}
          variant="secondary"
          onPress={async () => {
            await AsyncStorage.removeItem(INTERACTIVE_TUTORIAL_KEY).catch(() => {});
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

        <AdvancedSection />

        <Text style={styles.sectionTitle} accessibilityRole="header">DEVELOPER</Text>
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
            accessibilityRole="switch"
            accessibilityLabel="Debug overlay"
            accessibilityState={{ checked: debugEnabled }} aria-checked={debugEnabled}
          >
            <Text style={[styles.toggleText, debugEnabled && styles.toggleTextActive]}>
              {debugEnabled ? 'ON' : 'OFF'}
            </Text>
          </Pressable>
        </View>
        {/* FIT-ALL-BOARDS 2026-06-09 — Max board card height stepper.
            Persisted; consumed by game.tsx via AsyncStorage + AppState re-check. */}
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowLabel}>Max board card</Text>
            <Text style={styles.rowHint}>Cap on board card height ({BOARD_CAP_MIN}–{BOARD_CAP_MAX} dp). Default {BOARD_CAP_DEFAULT}.</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable
              onPress={() => applyBoardCardCap(boardCardCap - BOARD_CAP_STEP)}
              style={styles.toggleBtn}
              accessibilityRole="button"
              accessibilityLabel="Decrease max board card height"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.toggleText}>−</Text>
            </Pressable>
            <Text style={[styles.toggleText, { minWidth: 36, textAlign: 'center' }]}>{boardCardCap}</Text>
            <Pressable
              onPress={() => applyBoardCardCap(boardCardCap + BOARD_CAP_STEP)}
              style={styles.toggleBtn}
              accessibilityRole="button"
              accessibilityLabel="Increase max board card height"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.toggleText}>+</Text>
            </Pressable>
          </View>
        </View>

        <Button
          title={t().resetDefaults}
          variant="secondary"
          onPress={resetConfig}
          style={{ marginBottom: 24 }}
        />

        {isBeta && (
          <View>
            <Text style={styles.sectionTitle} accessibilityRole="header">BETA MODE</Text>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Version</Text>
              <Text style={styles.rowHint}>{Constants.expoConfig?.version ?? '—'} (EAS {Constants.expoConfig?.extra?.buildNumber ?? '—'})</Text>
            </View>
            {/* A6 (Batch A): "Reset Progress (beta)" REMOVED. It called
                AsyncStorage.clear() — nuking ALL storage (device/referral/auth state),
                far beyond progress. The surgical, guarded "Reset All Progress" in the
                DANGER ZONE below (multiRemove of a specific key list) is the single
                reset control. */}
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Mute quotes</Text>
              <Switch
                value={muteQuotes}
                onValueChange={(v) => {
                  setMuteQuotes(v);
                  AsyncStorage.setItem('caps_show_pro_quotes', v ? 'false' : 'true').catch(() => {});
                }}
                accessibilityLabel="Mute quotes"
              />
            </View>
            {/* A3 (Batch A): "Mute sounds" REMOVED. It wrote a dead key
                (caps_beta_mute_sounds — 0 readers) AND flipped the real
                config.soundEnabled, making it a second, conflicting control over the
                sound asset that "Sound Volume" (SoundToggle) already owns. Ambient
                Sound is real (utils/sounds.ts + assets/sounds/ambient.mp3) and stays. */}
          </View>
        )}

        <Text style={styles.sectionTitle} accessibilityRole="header">DANGER ZONE</Text>
        <ResetProgressButton />

        <Text style={styles.sectionTitle} accessibilityRole="header">CREDITS</Text>
        <View style={styles.creditsBox}>
          <Text style={styles.creditsText} accessibilityLabel="Pro Quotes: AI digital simulation — fictional quotes">🤖 Pro Quotes: AI digital simulation — fictional quotes</Text>
          <Text style={styles.creditsText} accessibilityLabel="Voice Clips: AI-generated voices via ElevenLabs">🔊 Voice Clips: AI-generated voices via ElevenLabs</Text>
          <Text style={styles.creditsText} accessibilityLabel="Not affiliated with any poker player mentioned">⚠️ Not affiliated with any poker player mentioned</Text>
          <Text style={styles.creditsText}>Voices are parody / entertainment only</Text>
        </View>
        <Pressable
          onPress={() => router.push('/rank' as any)}
          style={styles.privacyLink}
          accessibilityRole="button"
          accessibilityLabel="Your rank"
        >
          <Text style={styles.privacyLinkText}>
            <Text aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">🏆 </Text>
            Your Rank
          </Text>
        </Pressable>
        {/* A4 (Batch A): standalone Privacy Policy link removed — the Privacy Policy
            link now lives once, in the Apple-required legal footer below (paired with
            Terms). Same destination; no behaviour change. */}

        {/* Gambling disclaimer + legal links (Apple requirement) */}
        <View style={{ marginTop: 16, marginBottom: 8, alignItems: 'center' }}>
          <Text style={{ color: '#b8b8b8', fontSize: rf(11), textAlign: 'center', lineHeight: 18 }}>
            {"CAPS Poker is a free game with virtual chips only.\nNo real-money gambling.\nFor ages 17+."}
          </Text>
          <Pressable onPress={() => Linking.openURL('https://caps.ftable.co.il/privacy.html')} style={{ marginTop: 8 }} accessibilityRole="link" accessibilityLabel="Privacy policy">
            <Text style={{ color: '#c9c9c9', fontSize: rf(11), textDecorationLine: 'underline' }}>Privacy Policy</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL('https://caps.ftable.co.il/terms.html')} style={{ marginTop: 4 }} accessibilityRole="link" accessibilityLabel="Terms of use">
            <Text style={{ color: '#c9c9c9', fontSize: rf(11), textDecorationLine: 'underline' }}>Terms of Use</Text>
          </Pressable>
        </View>

        {/* Danger zone — account deletion (Apple/Google requirement) */}
        <View style={{ marginTop: 40, paddingTop: 20, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.1)' }}>
          <Pressable onPress={handleDeleteAccount} style={{ paddingVertical: 14, alignItems: 'center' }} accessibilityRole="button" accessibilityLabel="Delete account">
            <Text style={{ color: '#ef4444', fontSize: rf(14) }}>Delete Account</Text>
          </Pressable>
          <Text style={{ color: '#b8b8b8', fontSize: rf(11), textAlign: 'center', marginTop: 4 }}>
            This will permanently delete all your data
          </Text>
        </View>

        <View style={{ alignItems: 'center', paddingBottom: 8 }}>
          <VersionBadge />
          <Text style={{ color: '#b8b8b8', fontSize: rf(11), marginTop: 4 }}>
            OTA: {Updates.updateId?.slice(0, 8) ?? 'none'} | Ch: {Updates.channel ?? '?'} | RT: {Updates.runtimeVersion ?? '?'}
          </Text>
          <Text style={{ color: '#b8b8b8', fontSize: rf(11), marginTop: 2 }}>
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
    color: COLORS.mint,
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
  // VAMOS-QA-VISUAL-FIX 2026-06-19 — minWidth + paddingRight keep the label
  // column readable when the right-side input + long suffix (× N boards = M)
  // would otherwise eat the row and break the label onto multiple letters
  // ("Pot" → P/o/t).
  rowLeft: {
    flex: 1,
    minWidth: rs(110),
    paddingRight: rs(8),
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
    color: COLORS.mint,
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
  // VAMOS-QA-VISUAL-FIX 2026-06-19 — was a hard width: rv(40); "Cinematic"
  // (9 chars) overflowed and read as "Normainematic" alongside "Normal".
  // Now sized by content via paddingHorizontal; minWidth keeps Off/On etc.
  // tappable.
  selectorBtn: {
    height: rb(36),
    paddingHorizontal: rs(10),
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: rv(6),
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
    minWidth: 44,
    minHeight: 44,
  },
  selectorBtnActive: {
    backgroundColor: COLORS.mint,
    borderColor: COLORS.mint,
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
    backgroundColor: COLORS.mint,
    borderColor: COLORS.mint,
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
    color: 'rgba(255,255,255,0.7)',
    fontSize: rf(10),
    fontWeight: '600',
    marginLeft: rs(4),
    minWidth: rs(30),
    textAlign: 'left',
  },
  // S116: Privacy Policy
  privacyLink: {
    alignSelf: 'center',
    paddingVertical: rs(12),
    marginTop: rs(8),
  },
  privacyLinkText: {
    fontSize: rf(12),
    color: 'rgba(79,214,168,1)',
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
    borderColor: COLORS.mint,
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
    color: COLORS.mint,
  },
  previewRow: {
    flexDirection: 'row',
    gap: rs(3),
    justifyContent: 'center',
  },
  activePill: {
    backgroundColor: COLORS.mint,
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
    minHeight: 44,
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
    borderColor: COLORS.mint,
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
    color: COLORS.mint,
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
    borderColor: COLORS.mint,
    borderWidth: 2,
  },
  tileIcon: {
    fontSize: rf(24),
  },
  tileLabel: {
    // PR-J: was COLORS.textSecondary (#8a7a5a) on COLORS.feltLight (#8B0000)
    // ~2.7:1 — fails WCAG AA. Use COLORS.text (cream) for ~9.5:1.
    color: COLORS.text,
    fontSize: rf(11),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tileLabelActive: {
    // PR-J: brighten the active gold so it stays distinguishable from inactive cream.
    color: '#FFD700',
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
