/**
 * Tab Navigator — Home / Play / Friends / Cups / Profile
 * Task 6 from VAMOS_CAPS_homescreen_rebrand
 * Stack screens (game, results, replay, etc.) live above in app/_layout.tsx
 */
import { Tabs } from 'expo-router';
import { t } from '../../utils/i18n';
import { Platform, Text, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SCREEN_W = Dimensions.get('window').width;

const TAB_BG = '#0D0D0D';
const ACTIVE = '#FFD700';
const INACTIVE = 'rgba(255,255,255,0.35)';

function TabIcon({ label, emoji, focused }: { label: string; emoji: string; focused: boolean }) {
  // PR-J — emoji is decorative; the parent <a> already announces the localized
  // label. Without hiding the emoji from the a11y tree, screen readers would
  // read "house emoji house emoji home" (audit found 'innerText 🏠 🏠 בית').
  return (
    <Text
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ fontSize: focused ? 20 : 18, opacity: focused ? 1 : 0.5, textAlign: 'center' }}
    >
      {emoji}
    </Text>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: TAB_BG,
          borderTopColor: 'rgba(255,215,0,0.15)',
          borderTopWidth: 1,
          // PR-J — was 52; per-tab tappable rect measured 39px on web which
          // fails WCAG 2.5.5 (44×44 min) and Apple HIG 44pt. Bumped to 64 so
          // each tab gets a ~52px tappable rect on web and ~64px on iOS
          // (plus safe-area insets).
          height: 64 + (Platform.OS === 'ios' ? insets.bottom : 0),
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarShowLabel: SCREEN_W > 375,
        tabBarLabelStyle: {
          fontSize: SCREEN_W <= 375 ? 9 : 10,
          fontWeight: '600',
          letterSpacing: 0.3,
          marginTop: SCREEN_W <= 375 ? -4 : -2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t().tabHome,
          // PR-J: explicit a11y label = localized word only
          tabBarAccessibilityLabel: t().tabHome,
          tabBarIcon: ({ focused }) => <TabIcon label={t().tabHome} emoji="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="play"
        options={{
          title: t().tabPlay,
          // PR-J: explicit a11y label = localized word only
          tabBarAccessibilityLabel: t().tabPlay,
          tabBarIcon: ({ focused }) => <TabIcon label={t().tabPlay} emoji="♠️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: t().tabFriends,
          // PR-J: explicit a11y label = localized word only
          tabBarAccessibilityLabel: t().tabFriends,
          tabBarIcon: ({ focused }) => <TabIcon label={t().tabFriends} emoji="👥" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="cups"
        options={{
          title: t().tabCups,
          // PR-J: explicit a11y label = localized word only
          tabBarAccessibilityLabel: t().tabCups,
          tabBarIcon: ({ focused }) => <TabIcon label={t().tabCups} emoji="🏆" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t().tabProfile,
          // PR-J: explicit a11y label = localized word only
          tabBarAccessibilityLabel: t().tabProfile,
          tabBarIcon: ({ focused }) => <TabIcon label={t().tabProfile} emoji="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
