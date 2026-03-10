import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useGameStore } from '../store/gameStore';
import { COLORS } from '../constants/gameConfig';

export default function RootLayout() {
  const loadPersistedData = useGameStore((s) => s.loadPersistedData);

  useEffect(() => {
    loadPersistedData();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.background },
          animation: 'fade',
        }}
      />
    </GestureHandlerRootView>
  );
}
