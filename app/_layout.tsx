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
// Shows full crash details on screen so we can read them on device
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Text style={{ color: '#ff4444', fontSize: 16, fontWeight: '700', marginBottom: 10, textAlign: 'center' }}>
        CRASH DETAILS:
      </Text>
      <Text style={{ color: '#fff', fontSize: 13, textAlign: 'center', marginBottom: 8 }}>
        {error?.message ?? 'Unknown error'}
      </Text>
      <Text style={{ color: '#aaa', fontSize: 10, textAlign: 'center', marginBottom: 20 }}>
        {error?.stack?.slice(0, 600) ?? ''}
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

  // Global unhandled error logger — logs to console so we can see in Xcode/Metro
  useEffect(() => {
    const handler = (event: ErrorEvent) => {
      console.error('[GLOBAL ERROR]', event.message, event.error?.stack ?? '');
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('error', handler);
      return () => window.removeEventListener('error', handler);
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
