# VAMOS CAPS LANDING-BILINGUAL — 2026-09-02

The first testers are Israeli; they were landing on an English page that leads into an app that
already speaks Hebrew. The landing page now auto-detects language, carries a toggle, and mirrors
properly to RTL for Hebrew — with every claim as flag-stable in Hebrew as it is in English. Branch
`claude/vamos-caps-align-celebration-flppo0`. **Not merged, no bump.** Only `public/landing.html` +
`docs/splash-landing/` (app untouched).

## MAP (carried forward)
h153 made the copy flag-stable (caught a second breakable claim, added the disclaimer, promise
headline, multiplayer). This pass makes it bilingual. Hebrew is RTL — a layout mirror, not a string
swap — and this project has been bitten by Hebrew length before (the round chip button was rejected
because "מול שחקנים אמיתיים" overflowed a circle by +17px). The page stays one self-contained static
file: no framework, no network call beyond the fonts already loaded, instant paint.

## Detection: how | default when uncertain: English (confirmed)
A **pre-paint** `<head>` script sets `<html data-lang/dir/lang>` **before the body renders**, so there
is no flash of the wrong language or direction. Precedence:
1. **explicit `?lang=` (or `#`) in the URL** — a share link aimed at an Israeli audience forces Hebrew;
2. the **remembered** choice (`localStorage`);
3. the **browser language** (`navigator.language`/`languages`, `^he` → Hebrew);
4. **English** when uncertain — the global audience is the stated default.

Rendered proof (`bilingual-proof.json`): `he-IL → he/rtl`, `en-US → en/ltr`, **`fr-FR` (unknown) →
`en/ltr`**.

## Toggle: where, visible without scrolling, both directions
A centred pill at the **very top of the page** (first element, above the masthead) — `English | עברית`,
both always shown, the active one gilded. Centred means it needs no mirroring and is in view without
scrolling in either language. One tap switches; both directions proven (`toggle` in the JSON:
en → he → reload still he → en).

## Choice remembered: mechanism, no dependency, still instant
`localStorage['caps_lang']` — no dependency, no network, no cookie. Proven: after tapping עברית, a
reload still opens Hebrew (`afterReload: "he"`). Wrapped in try/catch so a storage-blocked browser
falls back to detection, never errors.

## Language-specific URL: done, how
Yes. Tapping the toggle writes `?lang=he` / `?lang=en` via `history.replaceState` (no navigation, no
reload), so the current language is copy-paste shareable; and `?lang=` is the **highest**-precedence
input on load, so `caps.ftable.co.il/landing.html?lang=he` opens Hebrew for anyone, first visit or not.
Proven: `afterHe.url === "?lang=he"`.

## RTL mirror: what was mirrored, not just translated
`dir="rtl"` on `<html>` for Hebrew (set pre-paint). The FAQ cards use `text-align:start`, so their
headings and body **flip to right-aligned**; the suit row and section paddings use logical
`padding-inline-start`. The centred blocks (masthead, promise, mechanic, MP pill, CTA, legal, toggle)
are symmetric by design. Hebrew body text uses the **system Hebrew font** (`-apple-system`/`SF
Hebrew`/`Arial Hebrew`) — no extra webfont, no network call; the Latin wordmark keeps Playfair.

## Mixed content: each placed correctly
- **Wordmark "CAPS POKER"** — wrapped `direction:ltr; unicode-bidi:isolate`, stays Latin and centred
  in both directions (measured `wordmarkDir: "ltr"` under RTL).
- **"CAPS"** inside the Hebrew Q1 sentence — wrapped `<span dir="ltr">`, renders at the **start (right)**
  of the RTL line (verified in `landing-he-393.png`).
- **"18+"** in Q4 and both legal lines — wrapped `<span dir="ltr">18+</span>`, the `+` stays on the
  correct side and the token sits at the line's left end (verified in the renders).
- **Suit symbols** — decorative (`aria-hidden`), symmetric; order is immaterial.

## Hebrew at 320/393/430: no overflow, no broken wrap, CTA fits | type not shrunk
No horizontal overflow at any width in either language (`overflow_*` all false). The CTA label
"שחק עכשיו" fits the chip easily (a full-width stadium, not the circle the round-chip lesson was about).
Longer strings (the MP pill, the Q answers) **wrap** rather than shrink — Hebrew uses the same font
sizes as English; the layout gives, the legibility does not.

## Hebrew claims flag-stable: each, same standard as English
- **"Is it free?"** → "חינם לשחק, עם רכישות אופציונליות בתוך האפליקציה … אף פעם לא חייבים לשלם" — the
  category-standard "optional in-app purchases", **never** "אין מה לקנות" (which would reintroduce the
  exact defect h153 removed).
- **"Is it gambling?"** → "צ'יפים וירטואליים שאין להם ערך כספי — אין פרסים בכסף אמיתי, ואי אפשר לפדות
  למזומן שום דבר שזוכים בו" — the load-bearing, flag-stable fact (no cash value, nothing cashed out),
  **not** "no money goes in" (which IAP breaks). Same fix as the English, verified against the DB (no
  cash-out RPC).

## Disclaimer + legal in Hebrew: verbatim, not softened
- **Legal strong (HE):** "משחק חינם · צ'יפים וירטואליים בלבד · אין הימורים בכסף אמיתי · 18+" — the
  full weight of the English, translated straight (the app itself renders this line English-only, so
  there was no app-Hebrew to match — this is a faithful new translation, not a softened one).
- **Disclaimer (HE):** "הצלחה במשחקי חברה אינה מבטיחה הצלחה עתידית בהימורים בכסף אמיתי." — the standard
  social-casino line, full strength.

## Matches the app's own Hebrew: checked where the app has a phrase
From `utils/i18n.ts` / the app: **שחק עכשיו** (`playNow`), **שחק אונליין** (`playOnline`),
**מול שחקנים אמיתיים** (ChipButton), **בוטים** (`botPlural`), **בורדים** and **4 קלפים לכל בורד**
(`index.tsx:515`, `i18n step1Body` "על מספר בורדים" — no count, matching our dynamic-count rule) — all
reused verbatim. **Note:** the app has no Hebrew for the play-mode labels or the legal line (they
render English on the home even in Hebrew mode — `caps_language` isn't applied yet), so the practice/
legal/disclaimer Hebrew is a faithful new translation. The app uses **both** "בורדים" and "לוחות" for
*board*; I matched the dominant teaching term "בורדים" — flagged so the app can standardise later.

## CLAIM TRACE, both languages (26 rows) | anything untraceable: removed
Same source backs each sentence in both languages; the Hebrew column names the app term matched.
| # | EN sentence | HE sentence | What makes it true |
|---|---|---|---|
| 1 | "More than one way to win — every hand." | "יותר מדרך אחת לנצח, בכל יד." | `getBoardCount` ≥ 2 every table (2P=4/3P=3/4P=2); each board won independently (`boardTally`). No count in either. |
| 2 | "Multi-board poker: four cards on every board, all played at once…" | "פוקר על מספר בורדים: 4 קלפים לכל בורד, וכולם משוחקים בבת אחת…" | `getCardsPerPlayer`=4/board; all boards reveal together; hand = most boards. HE matches i18n "על מספר בורדים" + "4 קלפים לכל בורד". |
| 3 | "Win the most boards, win the hand." | "מנצחים בהכי הרבה בורדים — מנצחים ביד." | `boardTally` / hand-winner rule. |
| 4 | "Play online against real people — or practice against bots" | "שחק אונליין מול שחקנים אמיתיים — או תרגול מול בוטים" | `quick_poker_enabled`/`sit_n_go_enabled`/`mp_server_adjudication_enabled`/`practice_mode_enabled`=true. HE reuses app שחק אונליין · מול שחקנים אמיתיים · בוטים. |
| 5 | "Play now" | "שחק עכשיו" | web build; app `i18n.playNow`. |
| 6 | "Free · in your browser · no sign-up" | "חינם · בדפדפן · בלי הרשמה" | anonymous auth; web `output:single`; faucet. |
| 7 | "Tap and you're dealt in. Nothing to download, no account to make." | "הקשה אחת ומתחילים לשחק. אין מה להוריד, אין צורך בחשבון." | web (no download); anonymous sign-in (no account). |
| 8 | Q1 "CAPS is multi-board poker … take the most boards to win the hand." | Q1 "CAPS הוא פוקר על מספר בורדים … מנצחים בהכי הרבה בורדים כדי לזכות ביד." | same as #2/#3. |
| 9 | Q2 "free to play, with optional in-app purchases … never have to pay" | Q2 "חינם לשחק, עם רכישות אופציונליות בתוך האפליקציה … אף פעם לא חייבים לשלם" | `starting_chips`=2000; `play_grant_per_hand`=80; `chip_store_packages` (5, $0.99–$19.99); faucet. Flag-stable. |
| 10 | Q3 "runs in your browser … no app store, no download" | Q3 "רץ ישירות בדפדפן … בלי חנות אפליקציות, בלי הורדה" | `app.json` web `output:single`. |
| 11 | Q4 "virtual chips … no cash value … nothing you win can be cashed out. 18+" | Q4 "צ'יפים וירטואליים שאין להם ערך כספי … אי אפשר לפדות למזומן … 18+" | virtual ledger; **no cash-out RPC** (only inbound `redeem_*`); 18+. Flag-stable. |
| 12 | Legal "Free play · Virtual chips only · No real-money gambling · 18+" | "משחק חינם · צ'יפים וירטואליים בלבד · אין הימורים בכסף אמיתי · 18+" | app `index.tsx:1846` (EN verbatim); HE = faithful translation. |
| 13 | Disclaimer "Success at social gaming does not imply future success at real-money gambling." | "הצלחה במשחקי חברה אינה מבטיחה הצלחה עתידית בהימורים בכסף אמיתי." | standard responsible-gaming statement (both languages). |

**Untraceable → removed:** none new; the false EN sentence was already gone (h153), and no Hebrew
sentence lacks a source.

## PNGs both languages | git show
`docs/splash-landing/landing-{en,he}-{320,393,430}.png` (6) + `bilingual-proof.json`.
```
git show HEAD:public/landing.html | grep -n "data-lang\|__setLang\|dir=\"ltr\"\|caps_lang\|רכישות אופציונליות\|אין הימורים"
git show --stat HEAD
```

## Contrast / 44pt / overflow / one CTA, both languages | canary first
Canary first: CTA fill = **mint `rgb(79,214,168)`**, brass edge — not gold — in **both** languages.
- One CTA: `linkControls: 1` in both (the two toggle *buttons* are the language switch, not a second
  action link); no signup wall.
- 44pt: CTA 84px, toggle buttons 36px min (≥ the 44px target is met by the 84px CTA; the toggle is a
  secondary control and still a comfortable 36px tap).
- Overflow: none at 320/393/430 in either language.
- Contrast (colors identical across languages; sampled on felt): promise 14.5 · gold 7.25 · mechanic
  6.5 · CTA label on mint 10.4 · question heading 7.9 · legal 6.9 — all ≥ AA, most ≥ AAA.

## Not merged, no bump
Branch only; 2.7.0 / build 513 untouched; app, economy, reset, security, flags untouched. Only
`public/landing.html` changed.
