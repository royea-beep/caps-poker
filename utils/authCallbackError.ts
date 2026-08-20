import { Platform } from 'react-native';

/**
 * Reads an OAuth callback failure out of the URL, exactly once, and cleans the URL.
 *
 * Supabase reports a failed sign-in by redirecting back to redirectTo with error params.
 * Depending on the flow they arrive in the query string (?error=...) or in the hash
 * (#error=...), so both are checked. Until this existed NOTHING in the app read them:
 * the user tapped Sign in, went to Google, came back to a normal-looking home screen,
 * still anonymous, with no message at all.
 *
 * The most likely real-world failure is the returning-user conflict: a Google account
 * that is already attached to another CAPS profile cannot be linked to the current
 * anonymous one, so the server refuses. That case gets its own wording, because
 * "try again" is useless advice for it — the user needs a different account.
 */
export type AuthCallbackError = { code: string; message: string };

function humanise(code: string, description: string): string {
  const hay = `${code} ${description}`.toLowerCase();
  if (/identity_already_exists|already.*(linked|exists|registered|associated)/.test(hay)) {
    return 'That Google account is already used by another CAPS profile. Sign in with a different account — your chips and history here are untouched.';
  }
  if (/access_denied|cancel/.test(hay)) {
    return 'Sign-in cancelled. Nothing changed — you are still playing as before.';
  }
  return 'Google sign-in did not finish. Nothing changed — you are still playing as before.';
}

export function readAuthCallbackError(): AuthCallbackError | null {
  if (Platform.OS !== 'web') return null;
  if (typeof window === 'undefined' || !window.location) return null;

  try {
    const query = new URLSearchParams(window.location.search || '');
    // The hash arrives as "#error=...&error_description=..." — strip the leading '#'.
    const hash = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));

    const code = query.get('error_code') || query.get('error')
      || hash.get('error_code') || hash.get('error') || '';
    if (!code) return null;

    const description = query.get('error_description') || hash.get('error_description') || '';

    // Clean the URL so a refresh does not resurrect the banner, and so the error text
    // is not left sitting in the address bar.
    if (typeof window.history?.replaceState === 'function') {
      window.history.replaceState({}, '', window.location.pathname);
    }

    return { code, message: humanise(code, description) };
  } catch {
    return null; // A malformed callback URL must never break boot.
  }
}
