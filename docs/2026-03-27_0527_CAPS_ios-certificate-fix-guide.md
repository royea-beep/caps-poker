# 🔐 iOS Certificate Fix — Step-by-Step
### Fixes TestFlight for: WINGMAN, Caps Poker, PostPilot, 9Soccer
### March 27, 2026

---

## המצב

Certificate אחד (`91411...7086`) בוטל → 4 פרויקטים שבורים.
הפתרון: יצירת certificate חדש + עדכון secrets ב-4 GitHub repos.

**זמן נדרש:** 30-50 דקות
**דרוש:** Mac עם Keychain Access + גישה ל-Apple Developer Portal

---

## שלב 1: יצירת Certificate Signing Request (CSR)

פתח **Keychain Access** במק:

1. תפריט עליון → **Keychain Access** → **Certificate Assistant** → **Request a Certificate From a Certificate Authority**
2. מלא:
   - **User Email Address:** `royearguan@gmail.com`
   - **Common Name:** `Roye Arguan`
   - **CA Email:** השאר ריק
   - **Request is:** ✅ Saved to disk
3. לחץ **Continue** → שמור כ-`CertificateSigningRequest.certSigningRequest`

---

## שלב 2: יצירת iOS Distribution Certificate

1. פתח: **https://developer.apple.com/account/resources/certificates/list**
2. לחץ על **"+"** (Create a New Certificate)
3. בחר **Apple Distribution** (לא iOS Distribution — Apple Distribution עובד לכל הפלטפורמות)
4. לחץ **Continue**
5. העלה את קובץ ה-CSR מהשלב הקודם
6. לחץ **Continue** → **Download**
7. פתח את הקובץ שהורדת (`distribution.cer`) — זה יוסיף אותו ל-Keychain

---

## שלב 3: Export ל-`.p12`

1. פתח **Keychain Access**
2. בצד שמאל: **login** keychain → **My Certificates**
3. מצא את **"Apple Distribution: Roye Arguan (3K9KJNGL9U)"** — החדש (לא ה-revoked)
4. קליק ימני → **Export "Apple Distribution: Roye Arguan..."**
5. שמור כ-`Certificates.p12`
6. הגדר סיסמה — **תזכור אותה!** (תצטרך אותה ב-GitHub Secrets)

---

## שלב 4: Base64 Encode

פתח Terminal והרץ:

```bash
# המר את ה-.p12 ל-Base64
base64 -i Certificates.p12 | pbcopy
```

זה מעתיק את ה-Base64 ל-clipboard. **שמור את זה בצד** — תצטרך אותו 4 פעמים.

---

## שלב 5: עדכון Provisioning Profiles

אם ה-profiles מצביעים על ה-cert הישן, צריך לחדש:

1. פתח: **https://developer.apple.com/account/resources/profiles/list**
2. לכל אפליקציה — בדוק:

| App | Bundle ID | Profile Name |
|-----|-----------|-------------|
| 9Soccer | `com.ftable.ninesoccer` | 9Soccer Distribution |
| WINGMAN | (check App Store Connect) | WINGMAN Distribution |
| Caps Poker | (check) | Caps Poker Distribution |
| PostPilot | (check) | PostPilot Distribution |

3. לכל profile:
   - לחץ עליו → **Edit**
   - ודא שה-cert **החדש** מסומן
   - לחץ **Save** → **Download**
4. המר כל profile ל-Base64:
```bash
base64 -i WINGMAN_Distribution.mobileprovision | pbcopy
```

---

## שלב 6: עדכון GitHub Secrets — כל 4 ה-repos

### Repo 1: `royea-beep/wingman`
פתח: **https://github.com/royea-beep/wingman/settings/secrets/actions**

| Secret Name | ערך חדש |
|-------------|---------|
| `DISTRIBUTION_CERTIFICATE_BASE64` | (ה-Base64 של ה-.p12 מלב 4) |
| `DISTRIBUTION_CERTIFICATE_PASSWORD` | (הסיסמה שבחרת בשלב 3) |
| `PROVISIONING_PROFILE_BASE64` | (ה-Base64 של ה-profile של WINGMAN) |

> **שים לב:** ב-WINGMAN שם ה-secret יכול להיות שונה (EAS Build משתמש בשמות אחרים).
> בדוק את `.github/workflows/` — חפש שמות secrets ב-YAML:
> ```
> grep -r "secrets\." .github/workflows/
> ```
> שמות אפשריים: `APPLE_CERTIFICATE_BASE64`, `P12_BASE64`, `MATCH_PASSWORD`, `EXPO_APPLE_*`

### Repo 2: `royea-beep/90Soccer-Mascots`
פתח: **https://github.com/royea-beep/90Soccer-Mascots/settings/secrets/actions**

עדכן את אותם secrets. ב-9Soccer ה-audit מציין:
- `DISTRIBUTION_P12_PASSWORD` — זה שם ה-secret שממתין מ-Roye

| Secret Name | ערך חדש |
|-------------|---------|
| `DISTRIBUTION_CERTIFICATE_BASE64` | (אותו Base64) |
| `DISTRIBUTION_P12_PASSWORD` | (אותה סיסמה) |
| `PROVISIONING_PROFILE_BASE64` | (profile של 9Soccer) |

### Repo 3: `royea-beep/caps-poker`
פתח: **https://github.com/royea-beep/caps-poker/settings/secrets/actions**

(אותו דבר — Base64 + password + profile)

### Repo 4: `royea-beep/PostPilot`
פתח: **https://github.com/royea-beep/PostPilot/settings/secrets/actions**

(אותו דבר)

---

## שלב 7: Trigger Builds

אחרי שעדכנת secrets ב-4 repos:

### WINGMAN:
```bash
cd wingman
git commit --allow-empty -m "fix: new iOS distribution certificate"
git push origin main
```
או: GitHub → Actions → "Mobile CI" → **Run workflow**

### 9Soccer:
```bash
cd 90Soccer-Mascots
git commit --allow-empty -m "fix: new iOS distribution certificate"
git push origin main
```
או: GitHub → Actions → "iOS TestFlight" → **Run workflow**

### Caps Poker:
```bash
cd caps-poker
git commit --allow-empty -m "fix: new iOS distribution certificate"
git push origin main
```

### PostPilot:
```bash
cd PostPilot
git commit --allow-empty -m "fix: new iOS distribution certificate"
git push origin main
```

---

## שלב 8: ולידציה

חכה 10-15 דקות ובדוק:

1. **GitHub Actions:** כל 4 ה-workflows צריכים לעבור ✅
2. **Email:** תקבל "is now available to test" מ-TestFlight לכל app
3. **Email:** לא תקבל "Certificate Revoked" errors
4. **TestFlight app:** כל 4 האפליקציות זמינות להתקנה

---

## 🚨 Troubleshooting

### "No signing certificate matching..." error
→ ה-Provisioning Profile עדיין מצביע על ה-cert הישן. חזור לשלב 5 ותחדש profiles.

### PostPilot נכשל ב-8 שניות
→ כנראה חסרים secrets נוספים מעבר ל-cert. בדוק:
```
grep -r "secrets\." .github/workflows/*.yml
```
רשימה טיפוסית של secrets נדרשים:
- `APPLE_ID` (royearguan@gmail.com)
- `APP_SPECIFIC_PASSWORD` (App Store Connect → App-Specific Passwords)
- `TEAM_ID` (3K9KJNGL9U)
- `MATCH_GIT_TOKEN` (if using Fastlane Match)

### 9Soccer ITMS-90725 (SDK version)
→ בעיה נפרדת. עדכן ב-`ios.yml`:
```yaml
- uses: maxim-lobanov/setup-xcode@v1
  with:
    xcode-version: '26.0'
```
**דדליין: 28 באפריל 2026** — אחרי זה Apple דוחה uploads.

---

## Summary

| מה | זמן | תוצאה |
|----|------|-------|
| CSR + Certificate | 5 דקות | cert חדש |
| Export .p12 + Base64 | 5 דקות | קובץ מוכן |
| Update profiles | 10 דקות | profiles מעודכנים |
| Update 4 repos secrets | 10 דקות | CI מוכן |
| Trigger builds + verify | 15 דקות | 4 apps ב-TestFlight |
| **סה"כ** | **~45 דקות** | **כל הפרויקטים חיים** |
