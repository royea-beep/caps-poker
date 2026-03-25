import 'react-native-reanimated';
import { useEffect, useState } from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { getSupabase } from '../utils/supabase';
import DebugOverlay, { debugLog } from '../components/DebugOverlay';
import { onCrashDetected } from '../utils/crashDetector';
import { checkPreviousCrash } from '../utils/dirtyShutdown';
import { sendCrashAlert } from '../utils/crashAlert';
import { getLastCrashScreenshots, clearCrashScreenshots } from '../utils/screenRecorder';
import { startCrashRecording, setCurrentScreen, initCrashSession, markCleanExit, flushCrashSessionNow, checkDirtyShutdown } from '../utils/crash-evidence';
import { initDebugger } from '@caps/debugger';
import { sendCrashToWhatsApp } from '../utils/debug-whatsapp';
import { CrashBoundary } from '../components/CrashBoundary';

// Lazy-load expo-screen-orientation (not available on web)
let ScreenOrientation: typeof import('expo-screen-orientation') | null = null;
if (Platform.OS !== 'web') {
  try {
    ScreenOrientation = require('expo-screen-orientation');
  } catch {}
}

// GestureHandlerRootView can fail to hydrate on web — use plain View
const RootWrapper = Platform.OS === 'web' ? View : GestureHandlerRootView;

// Initialize @caps/debugger — reads Supabase config from app constants
try {
  const Constants = require('expo-constants').default;
  const extra = Constants.expoConfig?.extra ?? {};
  initDebugger({
    appName: 'caps',
    version: Constants.expoConfig?.version ?? '1.0.0',
    supabaseUrl: extra.supabaseUrl ?? '',
    supabaseAnonKey: extra.supabaseAnonKey ?? '',
    whatsappEdgeFunctionUrl: `${extra.supabaseUrl ?? ''}/functions/v1/whatsapp-bot-handler`,
    alertPhone: '+972526173700',
    enabled: typeof __DEV__ !== 'undefined' && __DEV__,
    screenshotFps: 2,
    maxScreenshots: 10,
  });
} catch { /* non-blocking — debugger is optional */ }

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
        <Text style={splashStyles.sub}>Place Your Cards. Own Every Board.</Text>
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
  const [debugEnabled, setDebugEnabled] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('debug_overlay_enabled').then(v => {
      if (v === 'true') setDebugEnabled(true);
    }).catch(() => {});
  }, []);

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

  useEffect(() => {
    debugLog('🔵 app started')
    try {
      initCrashSession()
      startCrashRecording()
      setCurrentScreen('Splash')
    } catch (e) {
      debugLog(`[CrashEvidence] Failed to start — app continues without it: ${e}`, 'warn')
    }
  }, []);

  // AppState: flush + mark clean exit when backgrounded; detect dirty-shutdown on launch
  useEffect(() => {
    if (Platform.OS === 'web') return
    // Check for dirty shutdown from previous session
    checkDirtyShutdown(sendCrashToWhatsApp).catch(() => {})
    // Mark clean exit when going to background
    const { AppState } = require('react-native')
    const sub = AppState.addEventListener('change', (state: string) => {
      if (state === 'background' || state === 'inactive') {
        markCleanExit()
      } else if (state === 'active') {
        flushCrashSessionNow()
      }
    })
    return () => sub.remove()
  }, []);

  // Dirty shutdown detector — runs on every app open (native only)
  // If a previous game was active when the app died → send WhatsApp crash alert
  useEffect(() => {
    if (Platform.OS === 'web') return;
    debugLog('🔍 checking previous crash...');
    checkPreviousCrash().then(async (crashTs) => {
      if (!crashTs) {
        debugLog('🔍 no dirty flag — clean start');
        return;
      }
      const age = Math.round((Date.now() - crashTs) / 1000);
      debugLog(`💀 DIRTY SHUTDOWN detected — game was active ${age}s ago`, 'error');
      try {
        const { build, version } = (() => {
          try {
            const Application = require('expo-application');
            const Constants = require('expo-constants').default;
            const cfg = Constants.expoConfig;
            const nativeBuild = Platform.OS !== 'web' ? (Application.nativeBuildVersion ?? null) : null;
            return { build: nativeBuild ?? cfg?.ios?.buildNumber ?? 'unknown', version: cfg?.version ?? 'unknown' };
          } catch { return { build: 'unknown', version: 'unknown' }; }
        })();
        // Read screenshots saved to disk during previous session
        const screenshots = await getLastCrashScreenshots();
        debugLog(`💀 crash screenshots on disk: ${screenshots.length}`);
        debugLog(`💀 sending WhatsApp crash alert (build=${build} v${version})...`);
        await sendCrashAlert(null, null, `dirty-shutdown (${age}s ago)`, screenshots, { build, version });
        debugLog('💀 WhatsApp crash alert sent ✅');
        // Clean up screenshots after successful send
        await clearCrashScreenshots();
        debugLog('💀 crash screenshots cleared from disk ✅');
      } catch (e) {
        debugLog(`💀 crash alert failed: ${e}`, 'error');
      }
    }).catch((e) => { debugLog(`🔍 checkPreviousCrash threw: ${e}`, 'error'); });
  }, []);

  // OTA nuclear check — immediate + every 30s while app is open (production only)
  useEffect(() => {
    if (__DEV__) return;
    const forceUpdate = async () => {
      try {
        debugLog('[OTA] Checking for update...');
        debugLog(`[OTA] Current update ID: ${Updates.updateId}`);
        debugLog(`[OTA] Channel: ${Updates.channel}`);
        debugLog(`[OTA] Runtime version: ${Updates.runtimeVersion}`);
        const update = await Updates.checkForUpdateAsync();
        debugLog(`[OTA] Update available: ${update.isAvailable}`);
        if (update.isAvailable) {
          debugLog('[OTA] Fetching update...');
          await Updates.fetchUpdateAsync();
          debugLog('[OTA] Reloading...');
          await Updates.reloadAsync();
        }
      } catch (e) {
        debugLog(`[OTA] Error: ${e}`);
      }
    };
    forceUpdate();
    const interval = setInterval(forceUpdate, 30000);
    return () => clearInterval(interval);
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

  // Marathon auto-start — triggered via WhatsApp reply "4"
  useEffect(() => {
    if (Platform.OS === 'web') return;
    (async () => {
      try {
        const supabase = getSupabase();
        if (!supabase) return;
        const { data } = await supabase
          .from('app_config')
          .select('value')
          .eq('key', 'run_marathon')
          .single();
        if (data?.value?.requested) {
          await supabase.from('app_config').upsert({ key: 'run_marathon', value: { requested: false } });
          debugLog('🤖 Marathon requested via WhatsApp — starting in 2s');
          setTimeout(() => router.push('/game?autoSim=true&autoSimCount=10' as any), 2000);
        }
      } catch {}
    })();
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
    <RootWrapper style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <StatusBar style="light" />
      <CrashBoundary>
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
            <Stack.Screen name="stats" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="hand-history" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="replay" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="coaching" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="spectate" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="tournament" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="leaderboard" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="orientation-pick" options={{ animation: 'fade' }} />
            <Stack.Screen name="theme-pick" options={{ animation: 'slide_from_bottom' }} />
          </Stack>
        </WebContainer>
      </BugReporter>
      </CrashBoundary>
      {debugEnabled && <DebugOverlay />}
      {!splashDone && <SplashOverlay onDone={() => setSplashDone(true)} />}
    </RootWrapper>
  );
}
