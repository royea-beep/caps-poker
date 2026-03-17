# CAPS POKER — המשך מספרינט 07/08
# קרא MEMORY.md לפני הכל

---

## מצב נוכחי (11.3.2026)

### Builds קיימים
- **preview v1.1.0** (build 2) — ✅ finished — זה ה-build הנוכחי על המכשיר
  - ID: 181cf0de-bcd1-44e3-866d-cbd2b6a6a0ee
- **development v1.1.0** (build 2) — ✅ finished
  - ID: ca437e87-2678-4fab-9d1e-0129c8b94417

### בעיות שנפתרו
- expo-device לא היה מותקן → תוקן
- expo-notifications לא היה מותקן → **לא נוסף בכוונה** (לא חלק מהפרויקט)
- react-native-tcp-socket אין לו config plugin → הוסר מ-plugins, עובד דרך autolinking

### מה עוד לא נבדק
- [ ] האם preview build עולה על המכשיר ללא קריסה
- [ ] single player משחק שלם
- [ ] HOST GAME / JOIN GAME לא נבדקו על מכשיר אמיתי (דורש dev build + WiFi)

### Iron Rules (נעולים)
1. React Native + Expo only
2. iOS portrait only
3. All params runtime-configurable
4. Full Omaha evaluation
5. Bot is random only
6. No backend for single-player
7. Local multiplayer via react-native-tcp-socket ✅ LOCKED
8. Internet multiplayer via Supabase Realtime (Phase 2, לא הוטמע)

### Git
- Branch: main
- Last commit: fc02815 — sprint-07: EAS dev build config, multiplayer TODOs fixed, resilience, v1.1.0
- ספרינטים: 01-07 מחוברים

### הערות חשובות
- Expo Starter plan — $45 credits/חודש (~22 iOS builds)
- Additional Concurrency ($50) — **לבטל** כשיש זמן
- Wingman פרויקט נפרד ב: C:\projects\wingman\apps\mobile

---

## כשחוזרים — לפי סדר עדיפות

1. לאשר שה-preview build עובד על המכשיר
2. לבדוק single player flow מלא
3. אם הכל תקין → ספרינט 08: submit ל-TestFlight דרך App Store Connect
4. לאחר מכן → בדיקת multiplayer על dev build עם שני מכשירים

---

## פקודת המשך מהירה
```bash
cd C:/Projects/Caps
eas build:list --platform ios --limit 1
npx tsc --noEmit
npx jest --silent
```
