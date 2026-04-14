/**
 * Tab Navigator — Home / Play / Friends / Cups / Profile
 * Task 6 from VAMOS_CAPS_homescreen_rebrand
 * Stack screens (game, results, replay, etc.) live above in app/_layout.tsx
 */
import { Tabs } from 'expo-router';
import { Platform, Text, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SCREEN_W = Dimensions.get('window').width;

const TAB_BG = '#0D0D0D';
const ACTIVE = '#FFD700';
const INACTIVE = 'rgba(255,255,255,0.35)';

function TabIcon({ label, emoji, focused }: { label: string; emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: focused ? 20 : 18, opacity: focused ? 1 : 0.5, textAlign: 'center' }}>
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
          height: 52 + (Platform.OS === 'ios' ? insets.bottom : 0),
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : 6,
          paddingTop: 6,
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
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon label="Home" emoji="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="play"
        options={{
          title: 'Play',
          tabBarIcon: ({ focused }) => <TabIcon label="Play" emoji="♠️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Friends',
          tabBarIcon: ({ focused }) => <TabIcon label="Friends" emoji="👥" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="cups"
        options={{
          title: 'Cups',
          tabBarIcon: ({ focused }) => <TabIcon label="Cups" emoji="🏆" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon label="Profile" emoji="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
