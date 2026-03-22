import 'react-native-reanimated';
import { useEffect, useState } from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';
import Animated, { useSharedValue, withTiming, withSequence, withDelay, useAnimatedStyle } from 'react-native-reanimated';
import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import type { ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { COLORS } from '../constants/gameConfig';
import { useGameStore } from '../store/gameStore';
import * as Updates from 'expo-updates';
// expo-insights is a passive SDK — auto-collects crashes + app opens via native integration
// No API call needed; installing the package is sufficient
import 'expo-insights';
import { preloadSounds } from '../utils/sounds';
import { registerAndSavePushToken } from '../utils/notifications';
import { WebContainer } from '../components/WebContainer';
import { BugReporter } from '../components/BugReporter';
import { VersionBadge } from '../components/VersionBadge';
import { getSupabase } from '../utils/supabase';
import DebugOverlay, { debugLog } from '../components/DebugOverlay';
import { onCrashDetected } from '../utils/crashDetector';

// Lazy-load expo-screen-orientation (not available on web)
let ScreenOrientation: typeof import('expo-screen-orientation') | null = null;
if (Platform.OS !== 'web') {
  try {
    ScreenOrientation = require('expo-screen-orientation');
  } catch {}
}

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

function SplashOverlay({ onDone }: { onDone: () => void }) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.88);
  const isWeb = Platform.OS === 'web';
  const duration = isWeb ? 1000 : 3500;

  useEffect(() => {
    if (isWeb) {
      opacity.value = withSequence(
        withTiming(1, { duration: 300 }),
        withDelay(400, withTiming(0, { duration: 300 })),
      );
      scale.value = withTiming(1.02, { duration: 400 });
    } else {
      opacity.value = withSequence(
        withTiming(1, { duration: 600 }),
        withDelay(2400, withTiming(0, { duration: 500 })),
      );
      scale.value = withTiming(1, { duration: 600 });
    }
    const t = setTimeout(onDone, duration);
    return () => clearTimeout(t);
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={splashStyles.container}>
      <Animated.View style={[splashStyles.content, animStyle]}>
        <Text style={splashStyles.suits}>♠ ♥ ♦ ♣</Text>
        <Text style={splashStyles.title}>CAPS POKER</Text>
        <Text style={splashStyles.sub}>4 Boards. One Winner.</Text>
        <View style={splashStyles.divider} />
      </Animated.View>
    </View>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  content: { alignItems: 'center' },
  suits: { fontSize: 22, color: '#c9a84c', letterSpacing: 10, marginBottom: 18, opacity: 0.8 },
  title: { fontSize: 40, fontWeight: '900', color: '#c9a84c', letterSpacing: 5 },
  sub: { fontSize: 13, color: '#888', letterSpacing: 3, marginTop: 8, textTransform: 'uppercase' },
  divider: { width: 60, height: 2, backgroundColor: '#c9a84c', marginTop: 20, opacity: 0.4 },
});

export default function RootLayout() {
  const router = useRouter();
  const initSession = useGameStore((s) => s.initSession);
  const orientation = useGameStore((s) => s.orientation);
  const visualTheme = useGameStore((s) => s.visualTheme);
  const [splashDone, setSplashDone] = useState(false);

  // Global JS error handler — catches unhandled errors on native
  useEffect(() => {
    if (Platform.OS === 'web') return;
    try {
      const originalHandler = ErrorUtils.getGlobalHandler();
      ErrorUtils.setGlobalHandler((error, isFatal) => {
        if (isFatal) {
          debugLog(`💀 FATAL: ${error?.message ?? 'unknown'}`, 'error');
          onCrashDetected(error ?? new Error('unknown fatal error')).catch(() => {});
        }
        originalHandler(error, isFatal);
      });
    } catch {}
    return () => {};
  }, []);

  useEffect(() => { debugLog('🔵 app started'); }, []);

  // OTA update check — runs on every app open (production only)
  useEffect(() => {
    if (!__DEV__ && Platform.OS !== 'web') {
      (async () => {
        try {
          console.log('[OTA] checking... isEmbedded:', Updates.isEmbeddedLaunch, 'updateId:', Updates.updateId?.slice(0, 8) ?? 'none');
          const update = await Updates.checkForUpdateAsync();
          console.log('[OTA] isAvailable:', update.isAvailable);
          if (update.isAvailable) {
            console.log('[OTA] fetching update...');
            await Updates.fetchUpdateAsync();
            console.log('[OTA] reloading app...');
            await Updates.reloadAsync();
          }
        } catch (e) {
          console.log('[OTA] check failed (non-fatal):', String(e));
        }
      })();
    }
  }, []);

  useEffect(() => {
    initSession();
    preloadSounds();
    if (Platform.OS !== 'web') {
      registerAndSavePushToken().catch(() => {});
    }

    // Load Playfair Display from Google Fonts on web
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  // Lock screen orientation based on user choice
  useEffect(() => {
    if (!ScreenOrientation || !orientation) return;
    const lock = orientation === 'landscape'
      ? ScreenOrientation.OrientationLock.LANDSCAPE
      : ScreenOrientation.OrientationLock.PORTRAIT_UP;
    ScreenOrientation.lockAsync(lock).catch(() => {});
  }, [orientation]);

  // First-launch flow: theme pick → orientation pick → home
  useEffect(() => {
    if (!splashDone) return;
    if (visualTheme === null) {
      router.replace('/theme-pick');
    } else if (orientation === null) {
      router.replace('/orientation-pick');
    }
  }, [splashDone, visualTheme, orientation]);

  // Handle OAuth deep link callbacks (native)
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const handleUrl = async (url: string) => {
      const client = getSupabase();
      if (!client) return;
      if (url.includes('access_token') || url.includes('code=')) {
        await client.auth.exchangeCodeForSession(url).catch(() => {});
      }
    };
    Linking.getInitialURL().then((url) => { if (url) handleUrl(url); });
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  // Global unhandled error logger — web only
  // IMPORTANT: window.addEventListener does not exist on iOS/Android (Hermes global ≠ DOM Window)
  // Must guard with Platform.OS === 'web', not just typeof window !== 'undefined'
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    const handler = (event: ErrorEvent) => {
      console.error('[GLOBAL ERROR]', event.message, event.error?.stack ?? '');
    };
    window.addEventListener('error', handler);
    return () => window.removeEventListener('error', handler);
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
              animationDuration: 250,
            }}
          >
            <Stack.Screen name="index" options={{ animation: 'fade' }} />
            <Stack.Screen name="game" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="results" options={{ animation: 'fade_from_bottom' }} />
            <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
          </Stack>
        </WebContainer>
      </BugReporter>
      <VersionBadge />
      <DebugOverlay />
      {!splashDone && <SplashOverlay onDone={() => setSplashDone(true)} />}
    </RootWrapper>
  );
}
