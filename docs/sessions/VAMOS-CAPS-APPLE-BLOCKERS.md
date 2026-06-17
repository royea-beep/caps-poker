# VAMOS CAPS CAPS-APPLE-BLOCKERS
**Date:** 2026-04-23 IST

---

## Apple App Store blockers: Privacy Policy + Gambling Disclaimer + Terms

### GAME RULES:
- 2P=4 boards, 3P=3 boards, 4P=2 boards. 4 cards PER BOARD. 52-card deck.
- Virtual chips ONLY. No real money. No gambling.

### CARD.TSX IS LOCKED — DO NOT TOUCH.

---

## TASK 1 — Privacy Policy page

Create `app/privacy.tsx` (or a static HTML page) that will be accessible at the app's web URL.

Better approach: create a static HTML file and deploy to Vercel alongside the app.

Create file `public/privacy.html`:

```html
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CAPS Poker — מדיניות פרטיות</title>
<style>
  body { font-family: -apple-system, sans-serif; max-width: 700px; margin: 0 auto; padding: 24px; background: #0a0508; color: #ccc; line-height: 1.8; }
  h1 { color: #c9a84c; font-size: 24px; }
  h2 { color: #e0c070; font-size: 18px; margin-top: 32px; }
  a { color: #c9a84c; }
  .updated { color: #666; font-size: 13px; }
</style>
</head>
<body>
<h1>מדיניות פרטיות — CAPS Poker</h1>
<p class="updated">עדכון אחרון: אפריל 2026</p>

<h2>מבוא</h2>
<p>CAPS Poker ("האפליקציה") היא משחק קלפים חינמי עם צ'יפים וירטואליים בלבד. אין הימורים בכסף אמיתי. מדיניות זו מסבירה אילו נתונים אנו אוספים ואיך אנו משתמשים בהם.</p>

<h2>מידע שאנו אוספים</h2>
<p><strong>מידע חשבון (אופציונלי):</strong> אם תבחר להתחבר עם Google, נשמור את שמך ותמונת הפרופיל שלך. ניתן לשחק כאורח ללא מסירת מידע אישי.</p>
<p><strong>מזהה מכשיר:</strong> מזהה אנונימי של המכשיר שלך לצורך שמירת התקדמות במשחק.</p>
<p><strong>נתוני משחק:</strong> סטטיסטיקות משחק (ידות ששוחקו, ניצחונות, צ'יפים), הישגים, רצף יומי, ודירוג בלוח המובילים.</p>
<p><strong>נתוני שימוש:</strong> אירועי אנליטיקה אנונימיים (פתיחת אפליקציה, תחילת משחק, סיום משחק) לצורך שיפור המוצר.</p>
<p><strong>התראות Push:</strong> אם תאשר, נשמור את ה-token שלך לשליחת התראות.</p>
<p><strong>דיווחי באגים:</strong> אם תדווח על באג, נאסוף מידע טכני על המכשיר שלך וצילום מסך (אם תבחר לצרף).</p>
<p><strong>רכישות:</strong> אם תבצע רכישה באפליקציה, Apple מעבדת את התשלום. אנחנו שומרים רק את מזהה הקבלה לאימות.</p>

<h2>מידע שאיננו אוספים</h2>
<p>אנחנו <strong>לא</strong> אוספים: כתובת אימייל (נשמרת רק ב-Google Auth), מספר טלפון, מיקום, אנשי קשר, או כל מידע פיננסי.</p>

<h2>שימוש במידע</h2>
<p>המידע משמש אך ורק לצורכי: שמירת התקדמות במשחק, הצגת לוח מובילים, שיפור חוויית המשחק, שליחת התראות (אם אושרו), ותיקון באגים.</p>

<h2>שיתוף מידע</h2>
<p>אנחנו <strong>לא מוכרים ולא משתפים</strong> מידע אישי עם צדדים שלישיים. המידע מאוחסן ב-Supabase (תשתית ענן מאובטחת). Google מקבלת מידע אימות רק אם תבחר להתחבר דרכו.</p>

<h2>מחיקת חשבון</h2>
<p>ניתן למחוק את כל המידע שלך בכל עת דרך הגדרות > מחק חשבון. המחיקה היא מיידית ובלתי הפיכה — כל הנתונים (צ'יפים, הישגים, היסטוריה, פרופיל) יימחקו לצמיתות.</p>

<h2>אבטחה</h2>
<p>המידע מאוחסן בשרתים מאובטחים עם הצפנה בתעבורה (TLS) ובאחסון. גישה למסד הנתונים מוגנת באמצעות Row Level Security (RLS).</p>

<h2>ילדים</h2>
<p>האפליקציה מיועדת לגילאי 12+. איננו אוספים ביודעין מידע מילדים מתחת לגיל 13.</p>

<h2>שינויים במדיניות</h2>
<p>אם נעדכן מדיניות זו, נפרסם את הגרסה המעודכנת באפליקציה ובעמוד זה.</p>

<h2>יצירת קשר</h2>
<p>שאלות? פנה אלינו: <a href="mailto:support@ftable.co.il">support@ftable.co.il</a></p>
</body>
</html>
```

Also create `public/terms.html`:

```html
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CAPS Poker — תנאי שימוש</title>
<style>
  body { font-family: -apple-system, sans-serif; max-width: 700px; margin: 0 auto; padding: 24px; background: #0a0508; color: #ccc; line-height: 1.8; }
  h1 { color: #c9a84c; font-size: 24px; }
  h2 { color: #e0c070; font-size: 18px; margin-top: 32px; }
  a { color: #c9a84c; }
  .updated { color: #666; font-size: 13px; }
  .important { background: rgba(201,168,76,0.1); padding: 12px; border-radius: 8px; border: 1px solid rgba(201,168,76,0.2); }
</style>
</head>
<body>
<h1>תנאי שימוש — CAPS Poker</h1>
<p class="updated">עדכון אחרון: אפריל 2026</p>

<div class="important">
<p><strong>CAPS Poker הוא משחק חינמי עם צ'יפים וירטואליים בלבד. אין הימורים בכסף אמיתי. אין אפשרות להמיר צ'יפים לכסף אמיתי.</strong></p>
</div>

<h2>קבלת התנאים</h2>
<p>בשימוש באפליקציה, אתה מסכים לתנאים אלה. אם אינך מסכים, אנא הפסק להשתמש באפליקציה.</p>

<h2>תיאור השירות</h2>
<p>CAPS Poker הוא משחק קלפי פוקר מרובה לוחות למכשירים ניידים. המשחק כולל צ'יפים וירטואליים שאינם ניתנים להמרה לכסף אמיתי. המשחק מיועד לבידור בלבד.</p>

<h2>צ'יפים וירטואליים</h2>
<p>צ'יפים באפליקציה הם וירטואליים בלבד ואין להם ערך כספי. לא ניתן להמיר, למכור, או להעביר צ'יפים לכסף אמיתי. רכישות באפליקציה (אם קיימות) הן לצ'יפים וירטואליים בלבד ומעובדות דרך Apple.</p>

<h2>חשבון משתמש</h2>
<p>ניתן לשחק כאורח או להתחבר עם Google. אתה אחראי לשמירת הגישה לחשבונך. ניתן למחוק את חשבונך בכל עת מההגדרות.</p>

<h2>התנהגות מקובלת</h2>
<p>אסור: ניצול באגים, הונאה, שימוש בתוכנות צד שלישי למניפולציה, או כל פעילות שפוגעת בחוויית שחקנים אחרים.</p>

<h2>הגבלת אחריות</h2>
<p>האפליקציה מסופקת "כמות שהיא" (AS IS). איננו מתחייבים לזמינות רציפה או לשמירת נתונים. גיבוי נתונים הוא באחריות המשתמש.</p>

<h2>שינויים</h2>
<p>אנו רשאים לעדכן תנאים אלה בכל עת. המשך השימוש מהווה הסכמה לתנאים המעודכנים.</p>

<h2>יצירת קשר</h2>
<p><a href="mailto:support@ftable.co.il">support@ftable.co.il</a></p>
</body>
</html>
```

---

## TASK 2 — In-app gambling disclaimer

Add a visible disclaimer in TWO places:

### A. Settings screen — add disclaimer text at bottom (above "מחק חשבון"):

```typescript
<Text style={{
  color: '#666',
  fontSize: 11,
  textAlign: 'center',
  marginTop: 16,
  marginBottom: 8,
  lineHeight: 16,
}}>
  CAPS Poker הוא משחק חינמי עם צ'יפים וירטואליים בלבד.{'\n'}
  אין הימורים בכסף אמיתי.{'\n'}
  מיועד לגילאי 12+.
</Text>

<Pressable onPress={() => Linking.openURL('https://caps.ftable.co.il/privacy')}>
  <Text style={{ color: '#888', fontSize: 11, textAlign: 'center', textDecorationLine: 'underline' }}>
    מדיניות פרטיות
  </Text>
</Pressable>

<Pressable onPress={() => Linking.openURL('https://caps.ftable.co.il/terms')}>
  <Text style={{ color: '#888', fontSize: 11, textAlign: 'center', textDecorationLine: 'underline', marginTop: 4 }}>
    תנאי שימוש
  </Text>
</Pressable>
```

### B. Home screen — subtle footer text at very bottom:

```typescript
<Text style={{
  color: '#444',
  fontSize: 10,
  textAlign: 'center',
  marginTop: 24,
  marginBottom: 8,
}}>
  משחק חינמי | צ'יפים וירטואליים בלבד | גילאי 12+
</Text>
```

---

## TASK 3 — Link privacy/terms in the app for Apple Review

Apple looks for privacy policy link in the app. Make sure it's accessible from Settings:

```bash
grep -n "privacy\|Privacy\|מדיניות" app/ --include="*.tsx" -r | head -5
```

If not already linked, add the Pressable links from Task 2A.

---

## TASK 4 — Deploy privacy/terms pages to Vercel

The HTML files need to be accessible at:
- `https://caps.ftable.co.il/privacy` (or `/privacy.html`)
- `https://caps.ftable.co.il/terms` (or `/terms.html`)

If the app is a React Native web export on Vercel, add the HTML files to `public/` folder — Vercel serves static files from `public/` automatically.

```bash
# Verify files are in public/
ls public/privacy.html public/terms.html

# If using Expo web export, put them in web/ or public/
# Vercel will serve them at /privacy.html and /terms.html
```

After deploy, verify the URLs work:
```bash
curl -s -o /dev/null -w "%{http_code}" https://caps.ftable.co.il/privacy.html
# Should return 200
```

---

## TASK 5 — App Store description text (save for Roye to use in App Store Connect)

Create `docs/appstore-listing.md`:

```markdown
# CAPS Poker — App Store Listing

## App Name
CAPS Poker — משחק קלפים

## Subtitle (30 chars max)
פוקר מרובה לוחות

## Description (Hebrew)
CAPS Poker — משחק קלפי פוקר ייחודי עם מספר לוחות!

קבל 4 קלפים לכל לוח ובנה את היד הטובה ביותר מול הבוטים.
מספר הלוחות משתנה לפי מספר השחקנים — הכל מחפיסה אחת של 52 קלפים.

- 2 שחקנים = 4 לוחות
- 3 שחקנים = 3 לוחות
- 4 שחקנים = 2 לוחות

תכונות:
- משחק סולו מול בוטים חכמים (3 רמות קושי)
- מערכת כוסות: ברונזה עד יהלום
- משימות יומיות ורצף ניצחונות
- לוח מובילים ודירוג
- שיתוף תוצאות בוואטסאפ
- 100% בעברית

משחק חינמי. צ'יפים וירטואליים בלבד. אין הימורים בכסף אמיתי.

## Description (English)
CAPS Poker — a unique multi-board poker card game!

Get 4 cards per board and build the best poker hand against smart bots.
Board count changes by player count — all from one 52-card deck.

Features:
- Solo play against adaptive AI bots (3 difficulty levels)
- Cup system: Bronze to Diamond progression
- Daily missions and win streaks
- Leaderboard and rankings
- Share results via WhatsApp
- Fully localized in Hebrew

Free to play. Virtual chips only. No real-money gambling.

## Keywords
poker, cards, פוקר, קלפים, card game, multi-board, strategy, free, משחק

## Category
Games > Card

## Age Rating
12+ (Frequent/Intense Simulated Gambling — virtual chips only, no real money)

## Privacy Policy URL
https://caps.ftable.co.il/privacy.html

## Support URL
https://caps.ftable.co.il

## Copyright
2026 CAPS Poker
```

---

## DEPLOY
```bash
npx tsc --noEmit 2>&1 | tail -5
npx jest --forceExit 2>&1 | tail -5

# Deploy web (includes privacy/terms pages)
npx expo export --platform web --clear
node scripts/fix-web-html.js 2>/dev/null || true
cd dist && vercel --prod --yes && cd ..

# Deploy OTA for app changes
npm run ota -- --message "feat: Privacy policy + terms links + gambling disclaimer"
git add -A && git commit -m "feat: Apple blockers — privacy policy, terms, gambling disclaimer, App Store listing"
git push origin main
```

---

## AFTER AUDIT
```
public/privacy.html created:                YES/NO
public/terms.html created:                  YES/NO
Privacy accessible at URL:                   YES/NO (verify after Vercel deploy)
Terms accessible at URL:                     YES/NO
Settings: disclaimer text visible:           YES/NO
Settings: privacy + terms links:             YES/NO
Home: footer disclaimer text:                YES/NO
docs/appstore-listing.md created:            YES/NO
"No real money" in both Hebrew + English:    YES/NO
Age rating 12+ noted:                        YES/NO
Tests passing:                               [N]/[N]
OTA deployed:                                [hash]
```

Yes, allow all edits.
VAMOS CAPS CAPS-APPLE-BLOCKERS — END
