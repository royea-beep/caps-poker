/**
 * SideMenu — slide-in drawer from left.
 * S83 Clean Lobby: all secondary features live here.
 * ZERO Reanimated — uses RN Animated only.
 */
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useGameStore } from '../store/gameStore';
import { COLORS } from '../constants/gameConfig';
import { rf, rs, rv } from '../utils/responsive';
import { t, getLanguage, setLanguage, Language } from '../utils/i18n';

export interface SideMenuProps {
  visible: boolean;
  onClose: () => void;
  onShowTutorial: () => void;
  chips: number;
  user: any;
  onSignIn: () => void;
  onSignOut: () => void;
}

export default function SideMenu({
  visible,
  onClose,
  onShowTutorial,
  chips,
  user,
  onSignIn,
  onSignOut,
}: SideMenuProps) {
  const router = useRouter();
  const { width: screenW } = useWindowDimensions();
  const menuW = Math.round(screenW * 0.75);

  // VAMOS-LOBBY-MENU-CARDS-V1 2026-06-21 — drawer slides from the RIGHT to
  // match its trigger (avatar in the top-RIGHT of the lobby). Was a leftover
  // from the old RTL build that slid from the left.
  const translateX = useRef(new Animated.Value(menuW)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const playerAvatar = useGameStore((s) => s.playerAvatar) || '👤';
  const playerName = useGameStore((s) => s.playerName) || 'Player';
  // Subscribe to languageVersion so the menu re-renders when language changes
  const languageVersion = useGameStore((s) => s.languageVersion);
  void languageVersion; // suppress unused warning
  const currentLang = getLanguage();

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: 250,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: menuW,
          duration: 200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, menuW]);

  const navigate = (path: string) => {
    onClose();
    setTimeout(() => router.push(path as any), 60);
  };

  return (
    <View
      style={[StyleSheet.absoluteFillObject, styles.container]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {/* Dimmed overlay — tap to close */}
      <Animated.View
        style={[StyleSheet.absoluteFillObject, styles.overlay, { opacity: overlayOpacity }]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
      </Animated.View>

      {/* Menu panel */}
      <Animated.View style={[styles.menu, { width: menuW, transform: [{ translateX }] }]}>
        <ScrollView
          style={styles.menuScroll}
          contentContainerStyle={styles.menuContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile header */}
          <View style={styles.profileSection}>
            <View style={styles.profileAvatarWrap}>
              {user?.user_metadata?.avatar_url ? (
                <Image
                  source={{ uri: String(user.user_metadata.avatar_url) }}
                  style={styles.avatarImg}
                />
              ) : (
                <Text style={styles.profileAvatarEmoji}>{playerAvatar}</Text>
              )}
            </View>
            <Text style={styles.profileName} numberOfLines={1}>
              {user?.user_metadata?.full_name ?? playerName}
            </Text>
            <Text style={styles.profileChips}>
              {'💰 '}{(chips ?? 0).toLocaleString()}{' chips'}
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Online / Multiplayer — Tournament + local-WiFi host/join retired in Phase 3 */}
          <MenuItem icon="🎮" label={t().playOnline} onPress={() => navigate('/lobby/internet-host')} />

          <View style={styles.divider} />

          {/* Progress & History */}
          <MenuItem icon="⚔️" label={t().battlePass} onPress={() => navigate('/battle-pass')} />
          <MenuItem icon="📊" label={t().stats} onPress={() => navigate('/stats')} />
          <MenuItem icon="📜" label={t().handHistory} onPress={() => navigate('/hand-history')} />
          <MenuItem icon="🎓" label={t().coaching} onPress={() => navigate('/coaching')} />
          <MenuItem icon="👁" label={t().spectator} onPress={() => navigate('/spectate')} />
          <MenuItem icon="🏅" label={t().leaderboard} onPress={() => navigate('/leaderboard')} />

          <View style={styles.divider} />

          {/* Settings */}
          <MenuItem icon="⚙️" label={t().settings} onPress={() => navigate('/settings')} />
          <MenuItem
            icon="📖"
            label={t().tutorial}
            onPress={() => {
              onClose();
              setTimeout(onShowTutorial, 60);
            }}
          />
          <MenuItem
            icon="🌐"
            label={currentLang === 'he' ? `🌐 ${t().language}: ${t().languageHebrew}` : `🌐 ${t().language}: ${t().languageEnglish}`}
            onPress={async () => {
              const newLang: Language = currentLang === 'he' ? 'en' : 'he';
              await AsyncStorage.setItem('caps_language', newLang);
              setLanguage(newLang);
              onClose();
            }}
          />

          <View style={styles.divider} />

          {/* Auth */}
          {!user ? (
            <MenuItem
              icon="🔵"
              label={t().signIn}
              onPress={() => {
                onClose();
                setTimeout(onSignIn, 60);
              }}
            />
          ) : (
            <View style={styles.signedInRow}>
              <Text style={styles.signedInText} numberOfLines={1}>
                {String(user.user_metadata?.full_name ?? user.email ?? 'Signed in')}
              </Text>
              <Pressable
                onPress={() => {
                  onClose();
                  setTimeout(onSignOut, 60);
                }}
                hitSlop={8}
              >
                <Text style={styles.signOutText}>{t().signOut}</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
    >
      <Text style={styles.menuItemIcon}>{icon}</Text>
      <Text style={styles.menuItemLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 9999,
  },
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  menu: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#190408',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(201,168,76,0.18)',
  },
  menuScroll: {
    flex: 1,
  },
  menuContent: {
    paddingTop: rs(52),
    paddingBottom: rs(40),
    paddingHorizontal: rs(20),
  },
  profileSection: {
    alignItems: 'center',
    paddingBottom: rs(20),
    gap: rs(6),
  },
  profileAvatarWrap: {
    width: rv(64),
    height: rv(64),
    borderRadius: rv(32),
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderWidth: 2,
    borderColor: 'rgba(201,168,76,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: rs(4),
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  profileAvatarEmoji: {
    fontSize: rf(32),
  },
  profileName: {
    color: COLORS.textPrimary,
    fontSize: rf(16),
    fontWeight: '700',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  profileChips: {
    color: '#c9a84c',
    fontSize: rf(13),
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginVertical: rs(8),
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: rs(12),
    paddingHorizontal: rs(6),
    borderRadius: rv(10),
    gap: rs(14),
  },
  menuItemPressed: {
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  menuItemIcon: {
    fontSize: rf(19),
    width: rv(26),
    textAlign: 'center',
  },
  menuItemLabel: {
    color: COLORS.textPrimary,
    fontSize: rf(15),
    fontWeight: '500',
    letterSpacing: 0.2,
    flex: 1,
  },
  signedInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: rs(10),
    paddingHorizontal: rs(6),
    gap: rs(8),
  },
  signedInText: {
    flex: 1,
    color: 'rgba(255,255,255,0.5)',
    fontSize: rf(12),
    fontWeight: '400',
  },
  signOutText: {
    color: '#c9a84c',
    fontSize: rf(12),
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
