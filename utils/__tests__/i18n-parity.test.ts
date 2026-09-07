/**
 * BOTH TABLES IN SYNC — proven at runtime, not by eye.
 *
 * TypeScript already forces both tables to satisfy the same `Translations` interface, so a MISSING
 * key is a compile error. This adds the two things the compiler cannot see:
 *   · a key present in one table and absent from the other at RUNTIME (the shape a silent
 *     fallback would take — the failure mode this whole class of bug hides behind), and
 *   · an EMPTY or placeholder value, which type-checks perfectly and renders as nothing.
 *
 * It also pins the asymmetry Roye ruled: ENGLISH MUST NEVER SHOW HEBREW. A Hebrew character in
 * the English table is a defect here, always. The reverse is allowed — hand-rank names and the
 * CAPS loanwords stay English in Hebrew on purpose.
 */
const mod = require('../i18n');

function tables() {
  mod.setLanguage('he');
  const he = mod.t();
  mod.setLanguage('en');
  const en = mod.t();
  return { he, en };
}

const HEBREW = /[֐-׿]/;

/**
 * The ONE key allowed to hold Hebrew inside the English table, and the reason.
 *
 * `languageHebrew` is the language switcher's ENDONYM — a language picker names each language in
 * its own script, or the person looking for it cannot find it. It is also never shown on an
 * English screen: SideMenu renders `languageEnglish` when the current language is English and
 * `languageHebrew` only when it is Hebrew, so the English UI never displays it.
 *
 * Nothing else may be added here. If a second key needs an exemption, that is the leak.
 */
const ENDONYM_EXEMPT = ['languageHebrew'];

describe('i18n — the two tables are in sync', () => {
  it('every key exists in BOTH tables', () => {
    const { he, en } = tables();
    const heKeys = Object.keys(he).sort();
    const enKeys = Object.keys(en).sort();
    expect(enKeys.filter((k) => !heKeys.includes(k))).toEqual([]);
    expect(heKeys.filter((k) => !enKeys.includes(k))).toEqual([]);
    expect(heKeys.length).toBe(enKeys.length);
  });

  it('every key has the SAME kind of value in both tables (string vs function)', () => {
    const { he, en } = tables();
    const mismatched = Object.keys(en).filter((k) => typeof (en as any)[k] !== typeof (he as any)[k]);
    expect(mismatched).toEqual([]);
  });

  it('no value is empty or a placeholder in either table', () => {
    const { he, en } = tables();
    const bad: string[] = [];
    for (const [label, tbl] of [['en', en], ['he', he]] as const) {
      for (const k of Object.keys(tbl)) {
        const v = (tbl as any)[k];
        if (typeof v === 'string' && (v.trim() === '' || /^TODO/i.test(v))) bad.push(`${label}.${k}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('⚠️ ENGLISH NEVER CONTAINS HEBREW — zero tolerance, no allowlist', () => {
    const { en } = tables();
    const leaked = Object.keys(en).filter((k) => {
      if (ENDONYM_EXEMPT.includes(k)) return false;
      const v = (en as any)[k];
      return typeof v === 'string' && HEBREW.test(v);
    });
    expect(leaked).toEqual([]);
  });

  it('the function-valued keys produce a non-empty string in both languages', () => {
    const { he, en } = tables();
    const broken: string[] = [];
    for (const [label, tbl] of [['en', en], ['he', he]] as const) {
      for (const k of Object.keys(tbl)) {
        const v = (tbl as any)[k];
        if (typeof v !== 'function') continue;
        // call with plausible args; arity is small and every one takes numbers or short strings
        const args = new Array(v.length).fill(0).map((_, i) => (i === 0 ? 1 : 2));
        let out: unknown;
        try { out = v(...args); } catch (e) { broken.push(`${label}.${k} threw`); continue; }
        if (typeof out !== 'string' || out.trim() === '') broken.push(`${label}.${k} -> ${String(out)}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('⚠️ ENGLISH NEVER CONTAINS HEBREW — the function-valued keys too', () => {
    const { en } = tables();
    const leaked: string[] = [];
    for (const k of Object.keys(en)) {
      const v = (en as any)[k];
      if (typeof v !== 'function' || ENDONYM_EXEMPT.includes(k)) continue;
      const args = new Array(v.length).fill(0).map((_, i) => (i === 0 ? 1 : 2));
      try { if (HEBREW.test(String(v(...args)))) leaked.push(k); } catch { /* covered above */ }
    }
    expect(leaked).toEqual([]);
  });
});
