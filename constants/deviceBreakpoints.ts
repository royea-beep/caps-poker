import { Platform } from 'react-native';

export interface DeviceInfo {
  isMobileWeb: boolean;
  isTabletWeb: boolean;
  isDesktopWeb: boolean;
  isNativeSmall: boolean;
  isNativeMedium: boolean;
  isNativeLarge: boolean;
  W: number;
  H: number;
}

/** Call inside component with values from useWindowDimensions() — never at module level */
export function getDevice(W: number, H: number): DeviceInfo {
  return {
    isMobileWeb:    Platform.OS === 'web' && W < 500,
    isTabletWeb:    Platform.OS === 'web' && W >= 500 && W < 1024,
    isDesktopWeb:   Platform.OS === 'web' && W >= 1024,
    isNativeSmall:  Platform.OS !== 'web' && W <= 375,
    isNativeMedium: Platform.OS !== 'web' && W > 375 && W <= 430,
    isNativeLarge:  Platform.OS !== 'web' && W > 430,
    W,
    H,
  };
}

/**
 * Pick a responsive value based on current screen width.
 * Call with W from useWindowDimensions() — never at module level.
 */
export function rv(
  W: number,
  mobileweb: number,
  tablet: number,
  desktop: number,
  native: number,
): number {
  if (Platform.OS !== 'web') return native;
  if (W < 500) return mobileweb;
  if (W < 1024) return tablet;
  return desktop;
}
