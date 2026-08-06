# PRE-TESTER BACKLOG — reconstructed 2026-08-06

**Read-only reconstruction.** Nothing was built, tested, signed or generated to produce this file.
Items are **presented, not prioritised** — grouping is by what blocks what, never by preference.
Roye's requests are kept **verbatim in the language he wrote them**; paraphrasing a product request
is how it drifts.

---

## ⚠️ PROVENANCE — READ THIS FIRST, IT CHANGES WHAT THIS FILE IS WORTH

**The "ZMANAGER" archive does NOT contain the backlog.** It was found, and it is real, but it does
not hold what we believed it held.

- **Path:** `C:\Projects\META\ZProjectManager` — 35,739 files, 782 MB, mtimes 2026-03-06 → 2026-07-22.
- **CAPS records:** `Projects_SHAREDmemory\reports\cap-\` — **1,126 JSON files, 4.9 MB**, named
  `YYYY-MM-DD_12-00_{dev|qa|ux|publish}-session.json`, dated 2026-03-25 → 2026-07-21.
- **Measured across all 1,126 files:**

  | Field | Non-empty |
  |---|---|
  | `prompt_hebrew_input` (would hold Roye's requests) | **0** |
  | `decisions_made` | **0** |
  | `blockers_hit` | **0** |
  | `gems_discovered` | **0** |
  | `commit_hash` | **0** |

- The 598 non-boilerplate `tasks[].description` entries are **agent system-prompts** ("You are
  checking game flow integrity for the CAPS POKER Expo project…") — instructions *to* bots. A further
  164 are the literal string "Hello memory agent, you are continuing to observe the primary Claude
  session." **None of it is Roye asking for anything.**
- These are auto-generated (`prompt_file: synclog_…​.auto`), one per day at exactly 12:00, and they are
  **internally contradictory**: `2026-07-19_dev` reports `completed_tasks: 5, failed_tasks: 0` while
  three of its five tasks carry `"status":"partial"`, and `files_changed: 12` alongside
  `lines_added: 0, lines_removed: 0`. Each carries a self-assigned `grade` of 9.5 with
  `accuracy: 10, completeness: 10` on a record containing no content.

**Mining that archive for requirements would have produced a fabricated backlog** made of bot
system-prompts — the exact "suggestion mistaken for decision" failure this reconstruction exists to
prevent, in its most extreme form.

**The real record is the Claude Code transcripts:** `C:\Users\royea\.claude\projects\C--Projects-POKER-Caps\`
— `d85141ce…jsonl` (56 MB) and `ffb18d74…jsonl` (25 MB), plus the current session `613fb75a…jsonl`.
Streaming those yielded **263 human-authored messages over 2026-06-29 → 2026-07-31 (23 active days)**.
Of those, **184 are VAMOS sprint prompts — the strategist's words, not Roye's.**

⚠️ **Coverage gap:** the transcripts start **2026-06-29**. Anything Roye asked for before that date is
not in this reconstruction and is not represented below.

---

## BLOCKS SHIPPING

| Item | Source | Status |
|---|---|---|
| **A7 — דירוג 17+ → 18+** — *"17+ בוטל ב-Apple ב-31.1.2026. Simulated Gambling מחייב 18+. חוסם אישור App Store."* | Panel plan relayed by Roye, 2026-07-18 | **OPEN.** No age-rating field exists in `app.json`; this is an App Store Connect setting and cannot be confirmed from the repo. Explicitly self-described as blocking App Store approval. |
| **iOS cannot be shipped at all** — rescued distribution cert `2D06E852…` is ABSENT from the Apple team (revoked); its profile `5e450e58…` died with it. | Bot-discovered, 2026-08-06 | **RESOLVED IN PRINCIPLE, UNPROVEN.** Live cert `77BE68C1…` exists and we hold its private key; a new App Store profile `7905c170-f5aa-4b09-9f56-541156857ee9` was created against it. The rebuild that would prove it was interrupted by the machine crash. |
| **Machine suspected of failing RAM** | Bot-diagnosed, 2026-08-06 | **OPEN — gates everything.** 11 silent hard stops in 10 days. All build/signing paused pending Windows Memory Diagnostic. |

## BLOCKS TESTERS

| Item | Source | Status |
|---|---|---|
| **MP hole cards broadcast on an unauthenticated channel** — anyone with the anon key and a 4-char room code can watch every player's hand. | Bot-proven live | **OPEN.** Phase 0 channel authz designed (`docs/PHASE_0_CHANNEL_AUTHZ.md`), never shipped. Tolerable for testers, fatal once results matter. |
| **41 of 43 real iOS devices open the app and emit nothing further** | Bot-observed | **OPEN, cause unknown.** Layout ruled out (Play button visible/tappable 375–440). Telemetry transport ruled out. |
| **A3 — פקדי קול סותרים** — *"'Mute sounds' מול 'Sound Volume ON' + 'Ambient ON'. שני פקדים בקוטביות הפוכה לאותו נכס → באג לוגיקה מחכה."* | Panel plan relayed by Roye, 2026-07-18 | **UNVERIFIED.** |
| **A6 — שני כפתורי reset** — *"'Reset Progress (beta)' + 'Reset All Progress'. מה ההבדל? סכנת מחיקה בטעות."* | Panel plan relayed by Roye, 2026-07-18 | **UNVERIFIED.** Data-loss risk. |

## WANTED BEFORE TESTERS

Roye's own stated priority order, from the 2026-07-18 plan: **Batch C (cards) = #1 · Batch D (table) = #2 · Batch E = #3–#4.**

**BATCH A — באגים חוסמים** (remaining)
- **A2** — *"`â` על כפתור — כפתור המינוס ב'Max board card' מציג תו שבור (mojibake). זה על כפתור פעולה, לא בטקסט."*
- **A4** — *"כפילויות — 'Pro Quotes' פעמיים; 'Privacy Policy' פעמיים."*
- **A5** — *"תווית Colorblind שגויה — 'Green = Win, Red = Lose' הוא תיאור המצב הרגיל; המצב הזה בדיוק מבטל אותו (כחול/כתום)."*

**BATCH B — איחוד המראה לקול אחד** — *"היום: 5 בוררי מראה = 1,080 שילובים, אף אחד לא תוכנן. זו הסיבה המרכזית לחוסר 'וואו'."*
- **B1** — *"לאחד 5 בוררים לאחד: Visual Style(3) + Background Theme(4) + Home Theme(10) + Button Style(3) + Card Design(3)."*
- **B3** — *"Background Theme מת (או חלקי) — 'Vegas · Strip lights' מסומן פעיל אבל מסכי המשחק אפורים שטוחים. לאמת ולתקן/להסיר."*
- **B4** — *"'Dev preview' גלוי למשתמש — תווית פנימית שדלפה."*
- **B5** — *"סקשן DEVELOPER פתוח לרווחה בזמן ש-ADVANCED מקופל — היררכיה הפוכה. להסתיר."*
- **B6** — *"צבעי Home Theme הורסי-מותג — Neon סגול / Rose ורוד / Matrix ירוק מתנגשים חזיתית עם זהות ה-CAPS הזהוב. Emerald ו-Matrix כמעט זהים."*
- **B7** — *"'DANGER ZONE' בירוק-מנטה מעל כפתור אדום — הכותרת סותרת את משמעותה."*
- **B8** — *"שתי פרדיגמות toggle באותו מסך — מתגי iOS מול כפתורי ON/OFF מלבניים."*

**BATCH C — הקלפים (עדיפות #1 שלך)**
- **C2** — *"היררכיה הפוכה של הגב — הגב השחור הוא האלמנט הכי בולט; המידע שלא רואים צועק יותר מהחשוף."*
- **C3** — *"בעלוּת ויזואלית — הקלפים שלך והבוטים זהים לחלוטין. במשחק תחרותי חייבים לדעת מיד מה שלך."*
- **C4** — *"מסגרת לא מבדילה — קלף חשוף וגב-C שניהם במסגרת זהב. אותו סימון לשני מצבים הפוכים."*
- **C5** — *"מונוטוניות 5 גבים זהים ברצף."*

**BATCH D — שולחן / אווירה (עדיפות #2 שלך)**
- **D1** — *"לבדוק מה Felt/Vegas באמת עושים ואיפה הם נעצרים (למה לא מגיעים למסכי המשחק)."*
- **D3** — *"המשבצות הריקות (זיתי-בוצי) — הכי לא-אטרקטיביות ודווקא הן יעד הפעולה."*

## NICE TO HAVE

**BATCH E — עסיסיות ואנימציה (עדיפויות #3 ו-#4)**
- **E1** — *"רגע הניצחון — קונפטי/חלקיקים כבר יורים (results.tsx:557) אבל עדינים מדי. להגביר."*
- **E2** — *"רגע ההפסד — 'YOU LOSE' אדום סטטי; צריך להיות רך ומעודד כדי שישחק שוב."*
- **E3** — *"סתירה רגשית — 'YOU LOSE' ענק בראש ומיד '✅ YOU WIN' בבורד 1."*
- **E4** — *"אנימציות כניסה/היפוך/תגובה למגע לקלפים."*
- **E5** — *"'Tap to reveal' — הקריאה לפעולה המרכזית היא הטקסט הכי חלש במסך."*
- **E6** — *"'DEAL ME IN' נראה כמו באנר פרסומת מודבק; ו-3 יציאות מוערמות (REMATCH/HOME/DEAL ME IN)."*

**ממצאים נוספים לתיעוד** (Roye's plan explicitly filed these as not-a-batch)
- *"'Best possible hand' מציג קלפים כטקסט (Q♦ 4♠) ולא כקלפים."*
- *"בר XP כתום = צבע שביעי במערכת; 'Total XP' הוא הטקסט הדהוי ביותר."*
- *"3 תוויות בורד ב-3 צבעים (צהוב/כחול/ירוק) בלי הסבר."*

**Telemetry**
- **`card_placed` fourth path uninstrumented** — `game.tsx:446`, countdown-expiry fill, emits
  `arrangement_timeout` but no `card_placed`. Bot-raised. We cannot see how testers actually play.

## ALREADY DONE (with evidence)

| Item | Evidence |
|---|---|
| **A1 — היד חתוכה** (2nd card row clipped by floating "Auto-Place ALL") | Shipped `main 1b0a9dd`. MEMORY.md records the first attempt was a **no-op** (paddingBottom inside a ScrollView); real fix was lifting `handZone marginBottom rs(24)`. |
| **C1 — פני הקלף המשודרג** | Shipped 2026-07-24, `main aa94363`, web `index-f570f712`, OTA `b66c089f`. Default `v3`. |
| **B2 — Card Design בורר מת** | Likely resolved — `components/Card.tsx` now references `cardTheme` **7×**. Was "Card.tsx כופה isV2 ולא קורא cardTheme". **Verify on device before closing.** |
| **D2 — רקע משחק עם עומק** (felt) | Shipped 2026-07-25, `main 1653310`, web `index-680592c9`, OTA `4b95aa1b`. Per-theme root felt. |
| Practice-mode chip UI fully gated (S52–S55) | `main c768fa4`, OTA `b5749ca4`, regression test `completeOverlayGate.ts`. |
| Desktop-web card blowout | `main 5ee17ca` + `0156bca`. Cards were 0.102 × raw window width; now clamped. |

## STALE OR CONTRADICTED

| Item | What contradicts it |
|---|---|
| **"100% Hebrew UI"** | Superseded. UI language is **English**; hand labels English-only since 2026-06-17. Acting on the old instruction causes regressions. |
| **`CLAUDE.md`: "Visual: maroon felt #5C1818"** | Stale. Live palette is **Obsidian**. `design.ts CAPS_THEME` / `BOARD_IDENTITY` are dead (0 consumers, pre-Obsidian values). |
| **`CLAUDE.md`: "Build: B458"** / `app.json` buildNumber was 330 | Both wrong. Device truth was **507**; `app.json` now set to **508**. |
| **"Never suggest App Store submission unless Roye says so"** (`CLAUDE.md`) | Now in tension with **A7**, which Roye's own plan flags as blocking App Store approval. Needs his ruling. |
| **Wingman path `C:\Projects\wingman`** | Does not exist. Real path `C:\Projects\DATING\Wingman\apps\mobile`. |
| **Cert `25940834E62D8128F72C50262A8CEF03` / profile `6Z8LSXD297`** | Appear **nowhere** in the Apple team listing. Carried in MEMORY.md and repeated for several sprints as fact. |
| **"271 iOS devices"** vs "~43" | DB ground truth: **271 native devices in 30 days, 44 active in 7d.** |

---

## RECONCILIATION AGAINST THE STRATEGIST'S HELD LIST

| | Held belief | Archive verdict |
|---|---|---|
| **a** | iOS unshippable, cert revoked | **CONFIRMED** by Apple's own API (cert absent from team). Not in ZMANAGER — this is Aug work, past its 2026-07-21 cutoff. |
| **b** | First Expo-free build dies at signing | **CONFIRMED** — steps 1–13 of 16 passed; failure was the revoked cert, now addressed but unproven. |
| **c** | MP hole cards on unauthenticated channel | **CONFIRMED**, design doc exists, unshipped. |
| **d** | `card_placed` fourth path missing | **CONFIRMED** — `game.tsx:446`. |
| **e** | 41/43 iOS devices silent | **CONFIRMED** as still-open; cause remains unknown. |
| **f** | player chat / video tutorial / screenshot disk persistence | **NOT MENTIONED ANYWHERE** in 263 human messages or 1,126 archive records. No evidence Roye ever asked for these. Treat as unsourced until he confirms. |

### THE GAP — in the record but NOT in the held list

The strategist's list is **five infrastructure/security items**. The archive's actual backlog is
**~30 product/UX items** from Roye's own 2026-07-18 plan, none of which appear in it:

- The **entire Batch B thesis** — *"5 בוררי מראה = 1,080 שילובים… זו הסיבה המרכזית לחוסר 'וואו'"*. This
  is the single largest structural product complaint on record and it was absent from planning.
- **A7 (18+ rating)** — a hard App Store blocker, absent from the blocker list.
- **A3 / A6** — a waiting logic bug and a data-loss risk, both in Settings.
- **Roye's stated priority order** (cards #1, table #2, juice #3–4) — the only explicit prioritisation
  he has given, and it was not reflected anywhere.

The held list is not wrong; it is **infrastructure-only**. Every item on it is something a bot found.
Nothing Roye asked for was on it.
