import React, { useState, useEffect, useRef } from 'react';
import { debugLog } from '../components/DebugOverlay';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Platform, Alert, Linking } from 'react-native';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
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
    playHaptic('medium');
  } catch {}
}
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import CardComponent from '../components/Card';
import { useGameStore } from '../store/gameStore';
import { DEFAULT_CONFIG, COLORS, GameConfig, getBoardCount } from '../constants/gameConfig';
// BATCH-B: cardThemes / homeThemes-picker / friendsBgs imports removed — the four pickers were
// folded into Visual Style (Background+Home derived via VISUAL_THEME_AXES; Button dead; Card
// Design picker removed, cardTheme MECHANISM retained in the store for the card-face batch).
import { CapsHooks } from '../utils/learning';
import { playHaptic } from '../utils/haptics';
import { getSupabase } from '../utils/supabase';
import { getDeviceId } from '../utils/leaderboard';
import { getAuthState, logout } from '../utils/auth';
import { track } from '../utils/analytics';
import { OrientationType, VisualTheme } from '../store/gameStore';
import { VersionBadge, getDisplayBuild } from '../components/VersionBadge';
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

// Haptics had no off switch at all: soundEnabled/soundVolume have never covered vibration,
// so haptics fired with sound fully muted. Deliberately a SEPARATE channel from sound, not a
// second control over it — settings.tsx:1199-1203 records that a genuinely conflicting
// "Mute sounds" toggle was removed in Batch A, and this must not become another one.
function HapticsToggle() {
  const hapticsEnabled = useGameStore((s) => s.config.hapticsEnabled !== false);
  const updateConfig = useGameStore((s) => s.updateConfig);

  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowLabel}>Vibration</Text>
      </View>
      <Pressable
        onPress={() => { updateConfig({ hapticsEnabled: !hapticsEnabled }); CapsHooks.settingsChanged('hapticsEnabled', !hapticsEnabled); }}
        style={[styles.toggleBtn, hapticsEnabled && styles.toggleBtnActive]}
        accessibilityRole="switch"
        accessibilityLabel="Vibration enabled"
        accessibilityState={{ checked: hapticsEnabled }} aria-checked={hapticsEnabled}
      >
        <Text style={[styles.toggleText, hapticsEnabled && styles.toggleTextActive]}>
          {hapticsEnabled ? 'ON' : 'OFF'}
        </Text>
      </Pressable>
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
      {/* flexShrink+minWidth:0 so the volume readout stops running off a 320px screen — this
          row measured 219px wide in 150px of space, pushing "80%" to x 328 past a 320 edge. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: rs(4), flexShrink: 1, minWidth: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
          <View style={{ flexDirection: 'row', gap: rs(2), marginLeft: rs(6), flexShrink: 1, minWidth: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
        {/* A5 — filed as "the subtitle says Green = Win, Red = Lose on the toggle that REPLACES
            green and red". The string was NOT wrong: it is a live status line and it already
            switched to Blue/Orange when the mode was on. But sitting unlabelled under "Colorblind
            Mode" it reads as a description of what the toggle DOES rather than of what is active
            now — which is exactly how it came to be filed as a contradiction. The colours are
            correct; only the framing was ambiguous, so this adds the missing frame rather than
            changing the mapping. */}
        <Text style={styles.rowHint}>{colorblindMode ? 'Now: Blue = Win, Orange = Lose' : 'Now: Green = Win, Red = Lose'}</Text>
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
    // Was rf(9) — 9px at 390px and no larger anywhere, the only sub-10px COPY in settings
    // ("Timeless", "Arcade"). Floored at 10 for legibility.
    fontSize: rf(10, 10),
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
        // BR2.3 — this path is currently GUARANTEED to fail: `delete_user_account` was revoked
        // from anon/authenticated because it was exploitable (NULL-passthrough let any holder of
        // the shipped anon key delete another player's account across 22 tables). The grant is
        // NOT being restored; the replacement is an Edge Function that resolves identity from a
        // verified JWT.
        //
        // The control is KEPT rather than hidden, deliberately: Apple requires an in-app account
        // deletion path for apps that support account creation, so removing the button trades a
        // broken control for a review rejection. What changes is the copy — "try again later"
        // promised it would start working, which is the one thing we know is false.
        Alert.alert(
          'Account deletion unavailable',
          'Account deletion is temporarily disabled while we finish a security fix. Nothing has been deleted. Email royearguan@gmail.com and we will remove your account manually.'
        );
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
  // A3's showQuotes state REMOVED 2026-08-11 with the duplicate Pro Quotes row that was its
  // only consumer. The polarity fix it records still stands — ProQuotesToggle (:773) reads
  // ON = you get the thing — it is just owned by one control now instead of two.
  const isBeta = Constants.expoConfig?.extra?.isBeta === true;
  // B-8 — the DEVELOPER section (Debug Overlay, Max board card, Reset to Defaults) rendered
  // unconditionally for every player. Gated behind a 7-tap unlock on the Version row.
  //
  // Why a tap-gesture and not __DEV__ or an app_config flag:
  //  - __DEV__ is wrong: testers run a PRODUCTION build and still need the build number.
  //  - an app_config flag would make a settings screen depend on a network round-trip, and a
  //    failed fetch has to resolve to "hidden" anyway — so the flag buys nothing over a local
  //    gesture while adding a failure mode.
  // FAILS CLOSED: defaults to false, and a rejected AsyncStorage read leaves it false, so the
  // section is hidden unless someone has explicitly unlocked it on this device.
  const [devUnlocked, setDevUnlocked] = useState(false);
  const devTapCount = useRef(0);
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
    // A3 RESIDUAL hydration REMOVED 2026-08-11 along with the duplicate Pro Quotes row it fed.
    // Its only consumer was that row; ProQuotesToggle (:773) does its own read via the exported
    // PRO_QUOTES_ENABLED_KEY. Leaving a write-only state behind is the same dead-key shape this
    // very comment block was written to fix.
    // B-8 — fails closed: only an explicit 'true' unlocks; a rejected read leaves it hidden.
    AsyncStorage.getItem('caps_dev_unlocked').then(v => setDevUnlocked(v === 'true')).catch(() => {});
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

        {/* BATCH-B: Background/Home/Button/Card-design pickers folded into Visual Style above.
            Background + Home are now derived from visualTheme (see constants/visualThemes.ts
            VISUAL_THEME_AXES); Button Style was dead; Card Design picker removed (cardTheme
            mechanism retained for the card-face batch). */}
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

        <Text style={styles.sectionTitle} accessibilityRole="header" accessibilityLabel="Cards">🃏 CARDS</Text>
        <FourColorSuitsToggle />
        <ColorblindToggle />
        <HandSortToggle />

        {/* VAMOS UX-BATCH-2 (Item 1) — TIMING + BOT raw tuning knobs moved into the
            collapsed ADVANCED section at the bottom. Iron Rule 3 stays satisfied:
            everything is still runtime-configurable, just not on the front page. */}

        <Text style={styles.sectionTitle} accessibilityRole="header">AUDIO & NOTIFICATIONS</Text>
        <SoundToggle />
        <HapticsToggle />
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
        {/* B-8 PARITY — developer tooling that was rendering for every player, in TOOLS rather
            than DEVELOPER. Same `devUnlocked` gate as :1123 and :1303, so the node is not
            mounted when locked. Gated, not deleted. */}
        {devUnlocked && <Button title={t().simulationMode} variant="secondary" onPress={navigateToSimulation} style={{ marginBottom: 12 }} />}
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

        {/* B-8 — everything from here to the Reset to Defaults button is developer tooling and
            was rendering for every player. Wrapped in `devUnlocked &&` so the nodes are NOT
            MOUNTED when locked — a visually-hidden control is still in the tree and still
            reachable by a screen reader or an automated tap. */}
        {devUnlocked && (<>
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
        </>)}

        {isBeta && (
          <View>
            <Text style={styles.sectionTitle} accessibilityRole="header">BETA MODE</Text>
            {/* B-8 — the Version row stays visible: testers need the build number to report a bug
                against the right build, and it is not developer TOOLING. It doubles as the unlock:
                7 taps reveals the DEVELOPER section on this device only. Deliberately undiscoverable
                by accident and trivially explainable to a tester in one sentence. */}
            <Pressable
              style={styles.row}
              accessibilityRole="button"
              accessibilityLabel={`Version ${Constants.expoConfig?.version ?? 'unknown'}`}
              onPress={() => {
                devTapCount.current += 1;
                if (devTapCount.current >= 7 && !devUnlocked) {
                  setDevUnlocked(true);
                  AsyncStorage.setItem('caps_dev_unlocked', 'true').catch(() => {});
                  Alert.alert('Developer options', 'Developer section unlocked on this device.');
                }
              }}
            >
              <Text style={styles.rowLabel}>Version</Text>
              {/* G2 2026-08-08 — WAS `extra.buildNumber`, a HAND-MAINTAINED field that had
                  drifted: it still reads "330" while the binary shipped on 2026-08-06 is
                  CFBundleVersion 508 (commit e346e70 bumped ios.buildNumber and left extra
                  behind). This row is the ONLY place a tester reads a build number, so it was
                  reporting a number 178 behind reality — every "I'm on build X" report was
                  unusable. Now reads the INSTALLED BINARY via expo-application, which a stale
                  JS bundle cannot misreport. Falls back to the old field only on web, which
                  has no native build. */}
              <Text style={styles.rowHint}>
                {/* G2 FOLLOW-UP 2026-08-10 — the native fix at :1208-1215 was right, but on web
                    `nativeBuildVersion` is null so this still fell through to the abandoned
                    `extra.buildNumber` and printed 330. Web is the channel testers actually get.
                    getDisplayBuild() keeps the native path byte-identical and, on web, returns
                    the SAME commit sha that getBuildIdentity() puts in the bug_report payload —
                    so the screen and the report agree. */}
                {Constants.expoConfig?.version ?? '—'} (build {getDisplayBuild()})
              </Text>
            </Pressable>
            {/* A6 (Batch A): "Reset Progress (beta)" REMOVED. It called
                AsyncStorage.clear() — nuking ALL storage (device/referral/auth state),
                far beyond progress. The surgical, guarded "Reset All Progress" in the
                DANGER ZONE below (multiRemove of a specific key list) is the single
                reset control. */}
            {/* DUPLICATE "Pro Quotes" REMOVED 2026-08-11. This was the SAME setting as the
                ProQuotesToggle in TOOLS (:773, rendered :1074), not a second control — both
                write `caps_show_pro_quotes`, which is exactly what PRO_QUOTES_ENABLED_KEY
                (ProQuoteBanner.tsx:18) resolves to and what ProQuoteBanner.tsx:106 reads.
                Established by grepping the KEY, not by assuming from the matching label.
                Worse than merely redundant: each row held its OWN local state (`enabled` here
                vs `showQuotes` there), so toggling one left the other displaying the opposite
                until a remount.
                The TOOLS one survives because it uses the exported constant rather than a raw
                string literal, carries a hint ("Show fictional poker pro reactions"), and sits
                beside its companion Pro Voices row.
                Same reasoning as the "Mute sounds" removal recorded immediately below — a
                second, conflicting control over a setting another row already owns. */}
            {/* A3 (Batch A): "Mute sounds" REMOVED. It wrote a dead key
                (caps_beta_mute_sounds — 0 readers) AND flipped the real
                config.soundEnabled, making it a second, conflicting control over the
                sound asset that "Sound Volume" (SoundToggle) already owns. Ambient
                Sound is real (utils/sounds.ts + assets/sounds/ambient.mp3) and stays. */}
          </View>
        )}

        {/* B7 — this header inherited styles.sectionTitle, whose colour is COLORS.mint, so the
            one header that must read as a warning was rendering in the same calm mint as every
            other section heading (measured live: rgb(79,214,168)) directly above a destructive
            control. Colour was carrying a meaning that contradicted the words. Overridden to the
            #C62828 already used by the Reset All Progress control below it, so the warning and the
            action it guards now speak with one voice. */}
        <Text style={[styles.sectionTitle, { color: '#C62828' }]} accessibilityRole="header">DANGER ZONE</Text>
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
            {"CAPS Poker is a free game with virtual chips only.\nNo real-money gambling.\nFor ages 18+."}
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
          {/* B-8 PARITY — these two lines are raw OTA diagnostics ("OTA: none | Ch: | RT:",
              "Embedded: NO | unknown") and were rendering for every player at the very bottom
              of Settings. Gated on the SAME `devUnlocked` condition as the DEVELOPER section
              (:1123) so the nodes are not mounted when locked — a visually-hidden node is still
              in the tree and still reachable by a screen reader. Gated, not deleted: they are
              useful in development. */}
          {devUnlocked && (<>
          <Text style={{ color: '#b8b8b8', fontSize: rf(11), marginTop: 4 }}>
            OTA: {Updates.updateId?.slice(0, 8) ?? 'none'} | Ch: {Updates.channel ?? '?'} | RT: {Updates.runtimeVersion ?? '?'}
          </Text>
          <Text style={{ color: '#b8b8b8', fontSize: rf(11), marginTop: 2 }}>
            Embedded: {Updates.isEmbeddedLaunch ? 'YES' : 'NO'} | {Updates.createdAt?.toISOString().slice(0, 10) ?? 'unknown'}
          </Text>
          </>)}
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
    // Measured 61x25. This one is a header control on its own row with nothing beside it, so
    // growing it does not compress a neighbour — the brief expected it might, and it does not.
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
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
    // Measured on live at 390px: this box was x 139..472 (w 333) inside a row ending at x 359,
    // pushing "× 4 boards = 100" to x 379..472 — 82px past the viewport, unreadable at any
    // scroll position. Its computed grow/shrink was 0/0, so it could not give the width back.
    // flexShrink alone is not enough in a flex row: minWidth defaults to auto, which floors the
    // box at its content size and makes the shrink a no-op. Both are required.
    flexShrink: 1,
    minWidth: 0,
  },
  input: {
    backgroundColor: COLORS.background,
    color: COLORS.goldBright,
    fontSize: rf(16),
    fontWeight: '700',
    paddingHorizontal: rs(12),
    paddingVertical: rs(6),
    borderRadius: rv(6),
    // Was `minWidth: rv(70)` alone. On web a TextInput renders as an <input>, which takes the
    // BROWSER DEFAULT width (~173px) unless capped — minWidth is a floor, not a cap, so it
    // never constrained anything. That default is most of the 333px overflow above. Pinned to
    // the width the design already asked for; 4 digits at rf(16) plus padding fit inside it.
    width: rv(70),
    flexShrink: 0,
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
    // Lets the long suffix ("× 4 boards = 100") wrap inside the row instead of running off the
    // edge once rowRight can shrink.
    flexShrink: 1,
  },
  selectorRow: {
    flexDirection: 'row',
    gap: rs(6),
    // At 320px the three reveal-speed buttons did not fit and "Cinematic" landed at x 294..371
    // — off-screen and UNTAPPABLE, i.e. a feature unreachable on a small phone. Wrapping keeps
    // every option on screen without resizing the buttons (which would shrink the hit area,
    // and several are already under the 44px minimum).
    flexWrap: 'wrap',
    // flexWrap alone did NOT fix it — verified on the deployed build, "Cinematic" was still at
    // x 290..365 on a 320px viewport. The row's computed grow/shrink was 0/0, so it kept its
    // full 237px content width and never reached a width that would force a wrap. Wrapping
    // only does anything once the container can actually shrink; same pairing as rowLeft.
    flexShrink: 1,
    minWidth: 0,
    justifyContent: 'flex-end',
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

;

;

;

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

;
