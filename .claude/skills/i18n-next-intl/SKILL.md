---
name: i18n-next-intl
description: Internationalization patterns for Next.js with next-intl. Hebrew RTL primary, 13 supported languages. Use for any UI string, date, number, or layout direction.
---

# i18n Rules for 9Soccer

## MANDATORY — apply to ALL components:
- **NO hardcoded UI strings.** Every user-visible text must use `useTranslations('namespace')` from next-intl
- **Translation files:** `messages/{locale}.json` (he.json = primary, en.json = secondary)
- **RTL layout:** Use CSS logical properties ONLY:
  - `margin-inline-start` not `margin-left`
  - `padding-inline-end` not `padding-right`
  - `border-inline-start` not `border-left`
  - `text-align: start` not `text-align: left`
  - `inset-inline-start` not `left`
- `dir="rtl"` on `<html>` for Hebrew, Arabic, Persian, Urdu
- Numbers stay LTR even in RTL context (scores, timers, stats)

## Supported Locales (from DB: supported_languages table):
```
he (Hebrew) — PRIMARY, RTL
en (English) — SECONDARY, LTR
ar (Arabic) — WC 2026, RTL
es (Spanish) — WC 2026, LTR
pt (Portuguese) — WC 2026, LTR
fr (French) — WC 2026, LTR
de (German) — WC 2026, LTR
ja (Japanese) — WC 2026, LTR
ko (Korean) — WC 2026, LTR
nl (Dutch) — WC 2026, LTR
it (Italian) — WC 2026, LTR
tr (Turkish) — WC 2026, LTR
zh (Chinese) — WC 2026, LTR
```

## File Structure:
```
messages/
├── he.json    ← Primary (Hebrew)
├── en.json    ← Secondary (English)
└── ... (WC languages added post-launch)
```

## Date/Number Formatting:
- Dates: `useFormatter()` from next-intl, never `.toLocaleDateString()`
- Numbers: `Intl.NumberFormat` with explicit locale
- Currency: `Intl.NumberFormat` with `style: 'currency'`
- Plurals: ICU Message Format `{count, plural, =0 {...} one {# item} other {# items}}`

## Component Pattern:
```tsx
import { useTranslations } from 'next-intl';

export function MyComponent() {
  const t = useTranslations('myNamespace');
  return <h1>{t('title')}</h1>;
}
```

## Icons in RTL:
- Directional icons (arrows, chevrons) must flip: `[dir="rtl"] .icon { transform: scaleX(-1); }`
- Non-directional icons (home, settings, trophy) do NOT flip

## DO NOT:
- Use `margin-left`, `padding-right`, `text-align: left/right`, `float: left/right`
- Hardcode any user-visible string
- Use `.toLocaleDateString()` or `.toLocaleString()` without explicit locale
- Assume LTR layout — test Hebrew first, English second
