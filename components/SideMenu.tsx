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
  const playerName = useGameStore((s) => s.playerName) || t().playerFallback;
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
        {/*
          PRE-EXISTING, FOUND WHILE VERIFYING D1'S FLOOR — not a D1 change.
          This backdrop was the ONE unnamed control on the home screen, at every width, on the
          shipped build as well as the new one. Two faults, one line each:
            1. NO NAME. A full-screen button that announced nothing.
            2. STILL FOCUSABLE WHEN CLOSED. SideMenu stays MOUNTED with `pointerEvents: 'none'`,
               which stops touch but does NOT remove an element from the tab order or the
               accessibility tree on web — so a keyboard or screen-reader user landed on an
               invisible 393x788 target on every screen that renders this menu.
          `focusable={visible}` is the part that matters: pointerEvents was never going to do it.
        */}
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
          focusable={visible}
          accessibilityElementsHidden={!visible}
          importantForAccessibility={visible ? 'yes' : 'no-hide-descendants'}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
        />
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
              {'💰 '}{(chips ?? 0).toLocaleString()}{' '}{t().chipsWord}
            </Text>
          </View>

          <View style={styles.divider} />

          {/* VAMOS-NAV-3TABS 2026-08-31 — Friends/Clubs moved off the bottom bar to here (1 club,
              2 members ever). /friends route is unchanged; the tab was dropped with href:null. */}
          <MenuItem icon="👥" label={t().tabFriends} onPress={() => navigate('/friends')} />

          <View style={styles.divider} />

          {/* Secondary / rare features only. VAMOS-NAV-DEDUPE 2026-08-31 — REMOVED four duplicate
              entries so each destination has one obvious route:
                · Play Online  → canonical: the Play tab's Multiplayer Lobby + the big PLAY ONLINE
                  CTA on the home screen (this very drawer opens from that same screen).
                · Stats, Hand History, Settings → canonical: the Profile tab's menu rows.
              The drawer now holds only what has no other home: Battle Pass, Coaching, Tutorial,
              Language, and auth. (Leaderboard was already deduped to the Play tab.) */}
          {/* THE-LAST-THREE 2026-09-03 — BATTLE PASS ENTRY HIDDEN. The route, the screen, the store
              and the config all stay; only this door is closed. Measured, not assumed:
                · app_config.battle_pass_enabled = false since 2026-03-27, and NO client code reads
                  it (the constant was dropped from constants/economyConfig.ts on 2026-08-31), so
                  the flag could never have gated this link.
                · stores/battlePassStore.ts claimFreeReward()/claimPremiumReward() only append the
                  tier number to a local AsyncStorage array. They credit NO chips and unlock NO
                  cosmetic. Tier 1 advertises "500 chips" and pays zero.
                · upgradeToPremium() asks "Spend 5,000 chips to unlock the Premium track?" and then
                  charges nothing at all.
                · 0 of the 60 reward ids in constants/battlePassConfig.ts resolve anywhere in the
                  app. (`ocean`/`emerald` exist in constants/homeThemes.ts as HOME BACKGROUNDS —
                  a different namespace that no claim path touches.)
              A screen that promises sixty rewards and delivers none is the "no half-done features
              visible" release rule, so the link comes off the drawer until the rewards are real.
              To restore: delete this comment and uncomment the line below. */}
          {/* <MenuItem icon="⚔️" label={t().battlePass} onPress={() => navigate('/battle-pass')} /> */}
          <MenuItem icon="🎓" label={t().coaching} onPress={() => navigate('/coaching')} />

          <View style={styles.divider} />

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
          {/* MP-PROMPT 2026-08-20 — was `!user`, which is FALSE for every anonymous player because
              useAuthUser() returns the anonymous Supabase user object. Consequences, both live:
                1. The "Sign in" item was never shown to anyone anonymous (3,176 of 3,185 users),
                   which is the real reason only 2 accounts exist — not "no entry point".
                2. Anonymous players were shown SIGN OUT instead. With the device->auth.uid binding
                   now ENFORCING, signing out mints a NEW uid on next launch while the device stays
                   bound to the old one -> econ_bind_ok returns identity_mismatch -> that player's
                   economy calls fail permanently. Showing SIGN OUT to an anonymous user was a
                   lockout trap.
              An anonymous user is "not signed in" for UI purposes, so treat it as such. */}
          {(!user || user?.is_anonymous) ? (
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
    /* THE-ONE-DAY 2026-08-22 — every MenuItem was a bare Pressable, so RN-web emitted
       div[tabindex=0] with no role and no accessible name. Measured live: the whole side menu —
       ten entries — was invisible to assistive tech while being perfectly usable by sight. The
       icon is decorative and is hidden so the name is the label, not "🎮 Play online". */
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text
        style={styles.menuItemIcon}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {icon}
      </Text>
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
