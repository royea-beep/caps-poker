# VAMOS CAPS CAPS-ACCOUNT-DELETION
**Date:** 2026-04-23 IST

---

## Account Deletion Flow — Apple/Google App Store requirement

### WHY: Risk score 20 (highest) — Apple REJECTS apps without account deletion if they have registration/login.

### WHAT'S DONE (DB):
- `delete_user_account(p_device_id text, p_user_id uuid)` RPC — deletes from 22 tables + auth.users
- Audit log entry created before deletion
- Bug reports anonymized (not deleted — kept for QA)
- Verified working with dry test

### WHAT THIS VAMOS BUILDS:
1. "מחק חשבון" button in Settings/Profile
2. Two-step confirmation dialog (Apple requirement)
3. Call RPC → clear AsyncStorage → sign out → return to home

---

## TASK 1 — Add Delete Account to Settings/Profile screen

Find the Settings or Profile screen:
```bash
cd C:\Projects\Caps
grep -rn "Settings\|settings\|Profile\|profile" app/ --include="*.tsx" -l | head -10
```

Add a "מחק חשבון" section at the BOTTOM of the settings/profile screen (Apple guidelines: must be accessible but not prominent):

```typescript
import { Alert, Platform } from 'react-native';
import { getSupabase } from '../utils/supabase';
import { getDeviceId } from '../utils/leaderboard';
import { getAuthState, logout } from '../utils/auth';
import { track } from '../utils/analytics';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Delete Account handler
const handleDeleteAccount = async () => {
  // Step 1: First confirmation
  const firstConfirm = Platform.OS === 'web' 
    ? window.confirm('האם אתה בטוח שברצונך למחוק את החשבון? כל הנתונים יימחקו לצמיתות.')
    : await new Promise<boolean>((resolve) => {
        Alert.alert(
          'מחיקת חשבון',
          'האם אתה בטוח? כל הנתונים שלך יימחקו לצמיתות:\n\n• צ׳יפים ורצף יומי\n• היסטוריית ידות\n• הישגים וכוסות\n• פרופיל ודירוג',
          [
            { text: 'ביטול', style: 'cancel', onPress: () => resolve(false) },
            { text: 'כן, מחק הכל', style: 'destructive', onPress: () => resolve(true) },
          ]
        );
      });
  
  if (!firstConfirm) return;

  // Step 2: Second confirmation (Apple requires double-confirm for destructive actions)
  const secondConfirm = Platform.OS === 'web'
    ? window.confirm('פעולה זו בלתי הפיכה. למחוק?')
    : await new Promise<boolean>((resolve) => {
        Alert.alert(
          'אישור סופי',
          'פעולה זו בלתי הפיכה. כל הנתונים יימחקו ולא ניתן לשחזר אותם.',
          [
            { text: 'ביטול', style: 'cancel', onPress: () => resolve(false) },
            { text: 'מחק לצמיתות', style: 'destructive', onPress: () => resolve(true) },
          ]
        );
      });

  if (!secondConfirm) return;

  track('account_deletion_confirmed', {}, 'settings');

  try {
    const sb = getSupabase();
    const deviceId = await getDeviceId();
    const authState = await getAuthState();

    // Call delete RPC
    const { data, error } = await sb!.rpc('delete_user_account', {
      p_device_id: deviceId,
      p_user_id: authState.userId,
    });

    if (error) {
      Alert.alert('שגיאה', 'לא הצלחנו למחוק את החשבון. נסה שוב מאוחר יותר.');
      track('account_deletion_failed', { error: error.message }, 'settings');
      return;
    }

    // Clear ALL local storage
    await AsyncStorage.clear();

    // Sign out from Supabase
    await logout();

    track('account_deleted', { tables: data?.tables_affected }, 'settings');

    // Navigate to fresh start
    if (Platform.OS === 'web') {
      window.location.href = '/';
    } else {
      // Reset navigation to home
      router.replace('/');
    }
  } catch (e: any) {
    Alert.alert('שגיאה', 'משהו השתבש. נסה שוב.');
    track('account_deletion_error', { error: e.message }, 'settings');
  }
};
```

### UI for the button (at bottom of settings, separated):

```tsx
{/* Danger zone — at very bottom */}
<View style={{ 
  marginTop: 40, 
  paddingTop: 20, 
  borderTopWidth: 0.5, 
  borderTopColor: 'rgba(255,255,255,0.1)' 
}}>
  <Pressable 
    onPress={handleDeleteAccount}
    style={{ 
      paddingVertical: 14, 
      alignItems: 'center' 
    }}
  >
    <Text style={{ 
      color: '#ef4444', 
      fontSize: 14 
    }}>
      מחק חשבון
    </Text>
  </Pressable>
  <Text style={{ 
    color: '#555', 
    fontSize: 11, 
    textAlign: 'center', 
    marginTop: 4 
  }}>
    פעולה זו תמחק את כל הנתונים שלך לצמיתות
  </Text>
</View>
```

---

## TASK 2 — Analytics events

Track the full funnel:
- `account_deletion_pressed` — button tapped
- `account_deletion_confirmed` — second confirm passed
- `account_deleted` — RPC succeeded
- `account_deletion_failed` — RPC error
- `account_deletion_cancelled` — user backed out

---

## TASK 3 — Verify fresh start after deletion

After account is deleted and app reloads:
- Onboarding should show again (AsyncStorage cleared)
- Chips should be default 1000
- No streak, no achievements, no history
- Anonymous auth creates new user on next open

Test: delete → reopen → verify clean state.

---

## DEPLOY
```bash
npx tsc --noEmit 2>&1 | tail -5
npx jest --forceExit 2>&1 | tail -5
npm run ota -- --message "feat: Account deletion flow (Apple/Google requirement)"
git add -A && git commit -m "feat: Account deletion — delete_user_account RPC + Settings UI + double confirm"
git push origin main
```

---

## AFTER AUDIT
```
"מחק חשבון" button in Settings/Profile:     YES/NO
Double confirmation dialog (Hebrew):         YES/NO
delete_user_account RPC called:              YES/NO
AsyncStorage.clear() after deletion:         YES/NO
Supabase sign-out after deletion:            YES/NO
Navigate to home after deletion:             YES/NO
Analytics: deletion funnel tracked:          YES/NO
Fresh start works (onboarding shows):        YES/NO
Tests passing:                               [N]/[N]
OTA deployed:                                [hash]
```

Yes, allow all edits.
VAMOS CAPS CAPS-ACCOUNT-DELETION — END
