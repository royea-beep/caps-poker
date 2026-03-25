# CAPS POKER — ElevenLabs Pro Voices Auto-Generator
**Date:** 2026-03-21 08:47 IST

---

## שלב 1 — הרשמה (2 דקות)

1. לך ל: https://elevenlabs.io
2. צור חשבון (חינמי מספיק להתחלה)
3. לך ל: https://elevenlabs.io/settings/api-keys
4. צור API Key → העתק אותו
5. שמור אותו ב: `C:\Projects\Caps\.env` כ:
   ```
   ELEVENLABS_API_KEY=your_key_here
   ```

---

## שלב 2 — Voice Cloning (10 דקות)

לכל שחקן צריך דגימת אודיו של ~1 דקה. מקורות מומלצים:

| שחקן | חפש ב-YouTube |
|-------|---------------|
| Daniel Negreanu | "Daniel Negreanu interview" — יש אלפי סרטונים |
| Phil Hellmuth | "Phil Hellmuth rant" — הקול הכי מוכר בפוקר |
| Phil Ivey | "Phil Ivey interview" — שקט אבל יש |
| Michael Mizrachi | "Michael Mizrachi interview WSOP" |
| Erik Seidel | "Erik Seidel poker interview" |
| Justin Bonomo | "Justin Bonomo interview" |
| Bryn Kenney | "Bryn Kenney poker interview" |
| Ali Imsirovic | "Ali Imsirovic interview" |
| Chance Kornuth | "Chance Kornuth chip leader coaching" |
| Rampage (Ethan Yau) | "Rampage poker vlog" — הכי קל, יש טונות |

### איך לעשות clone:
1. הורד דגימה (אפשר להקליט מהמסך, או להשתמש ב-yt-dlp)
2. לך ל: https://elevenlabs.io/voice-lab
3. "Add Generative or Cloned Voice" → "Instant Voice Clone"
4. העלה את הקובץ → תן שם (למשל "Negreanu")
5. **העתק את ה-Voice ID** — צריך אותו לסקריפט

חזור על זה ל-10 שחקנים. בסוף יהיו לך 10 Voice IDs.

---

## שלב 3 — הדבק Voice IDs בסקריפט

פתח את `generate_voices.py` (הקובץ השני שמצורף) ועדכן את `VOICE_IDS`:

```python
VOICE_IDS = {
    "Negreanu": "paste_voice_id_here",
    "Hellmuth": "paste_voice_id_here",
    "Ivey": "paste_voice_id_here",
    "Mizrachi": "paste_voice_id_here",
    "Seidel": "paste_voice_id_here",
    "Bonomo": "paste_voice_id_here",
    "Kenney": "paste_voice_id_here",
    "Imsirovic": "paste_voice_id_here",
    "Kornuth": "paste_voice_id_here",
    "Rampage": "paste_voice_id_here",
}
```

---

## שלב 4 — הרץ

```
cd C:\Projects\Caps
pip install elevenlabs requests
python generate_voices.py
```

הסקריפט ייצר 20 קבצי mp3 בתיקייה `assets/sounds/pro-voices/`.

---

## שלב 5 — שלח לי

אחרי שהסקריפט מסיים — שלח לי confirmation ואני אכין VAMOS שמטמיע את הקבצים באפליקציה עם disclaimers + kill switch.
