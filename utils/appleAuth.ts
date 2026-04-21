import { Platform } from 'react-native';

export interface AppleAuthResult {
  userId: string;
  email: string | null;
  fullName: string | null;
}

let AppleAuthentication: typeof import('expo-apple-authentication') | null = null;
if (Platform.OS === 'ios') {
  try { AppleAuthentication = require('expo-apple-authentication'); } catch {}
}

export async function isAppleAuthAvailable(): Promise<boolean> {
  if (!AppleAuthentication) return false;
  return AppleAuthentication.isAvailableAsync();
}

export async function signInWithApple(): Promise<AppleAuthResult | null> {
  if (!AppleAuthentication) return null;
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    const fullName = credential.fullName
      ? [credential.fullName.givenName, credential.fullName.familyName]
          .filter(Boolean)
          .join(' ') || null
      : null;
    return { userId: credential.user, email: credential.email ?? null, fullName };
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'ERR_REQUEST_CANCELED') {
      return null;
    }
    throw err;
  }
}
