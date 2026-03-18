import 'react-native-reanimated';
import { useEffect } from 'react';
import { View, Text, Platform } from 'react-native';
import { Stack } from 'expo-router';
import type { ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { COLORS } from '../constants/gameConfig';
import { useGameStore } from '../store/gameStore';
import { preloadSounds } from '../utils/sounds';
import { WebContainer } from '../components/WebContainer';
import { BugReporter } from '../components/BugReporter';
import { VersionBadge } from '../components/VersionBadge';

// GestureHandlerRootView can fail to hydrate on web — use plain View
const RootWrapper = Platform.OS === 'web' ? View : GestureHandlerRootView;

// expo-router error boundary — catches JS errors in any screen
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <Text style={{ color: '#c9a84c', fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
        Something went wrong
      </Text>
      <Text style={{ color: '#888', fontSize: 12, textAlign: 'center', marginBottom: 24 }}>
        {error.message}
      </Text>
      <Text
        onPress={retry}
        style={{ color: '#c9a84c', fontSize: 15, fontWeight: '700', borderWidth: 1, borderColor: '#c9a84c', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 }}
      >
        Try Again
      </Text>
    </View>
  );
}

export default function RootLayout() {
  const initSession = useGameStore((s) => s.initSession);

  useEffect(() => {
    initSession();
    preloadSounds();

    // Load Playfair Display from Google Fonts on web
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  return (
    <RootWrapper style={{ flex: 1 }}>
      <StatusBar style="light" />
      <BugReporter>
        <WebContainer>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: COLORS.background },
              animation: 'fade',
            }}
          />
        </WebContainer>
      </BugReporter>
      <VersionBadge />
    </RootWrapper>
  );
}
