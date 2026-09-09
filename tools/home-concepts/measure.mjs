/**
 * ONE CONTRAST PASS, used on BOTH the concepts and the shipping screen — so the comparison is
 * like for like and a concept cannot look better than the control by being measured differently.
 *
 * Contrast is computed against the backdrop a pixel is ACTUALLY on: the ancestor chain is walked
 * and every translucent layer composited, because a token pair says nothing about what a
 * see-through panel resolves to. That distinction is what made an earlier slot-outline figure
 * wrong by 40%.
 */
export const MEASURE_FN = `(root) => {
  const L = (c) => { const s = c.map((v) => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); });
    return 0.2126*s[0] + 0.7152*s[1] + 0.0722*s[2]; };
  const parse = (str) => { const m = String(str).match(/rgba?\\(([^)]+)\\)/); if (!m) return null;
    const p = m[1].split(',').map(Number); return { rgb: p.slice(0,3), a: p.length > 3 ? p[3] : 1 }; };
  const over = (fg, bg) => fg.rgb.map((v, i) => v * fg.a + bg[i] * (1 - fg.a));
  const backdrop = (el) => { let n = el;
    while (n && n !== document.documentElement) { const b = parse(getComputedStyle(n).backgroundColor);
      if (b && b.a >= 1) return b.rgb; n = n.parentElement; }
    return [5,5,5]; };
  const ratio = (a, b) => { const [hi, lo] = L(a) > L(b) ? [L(a), L(b)] : [L(b), L(a)];
    return (hi + 0.05) / (lo + 0.05); };
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05
      && r.right > 0 && r.left < (root.getBoundingClientRect ? root.getBoundingClientRect().right : innerWidth); };
  const name = (el) => (el.getAttribute('aria-label') || el.textContent?.trim() || '').trim();
  const texts = [...root.querySelectorAll('*')].filter((el) => vis(el) &&
    [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && !el.hasAttribute('aria-hidden'));
  const items = texts.map((el) => { const cs = getComputedStyle(el); const fg = parse(cs.color);
    const size = parseFloat(cs.fontSize); const wgt = parseInt(cs.fontWeight) || 400;
    const large = size >= 24 || (size >= 18.66 && wgt >= 700);
    const bg = backdrop(el); const eff = fg.a >= 1 ? fg.rgb : over(fg, bg);
    return { text: el.textContent.trim().replace(/\\s+/g,' ').slice(0,30), size: +size.toFixed(1), large,
             ratio: +ratio(eff, bg).toFixed(2), need: large ? 3 : 4.5 }; });
  const ctrls = [...root.querySelectorAll('button,[role="button"],a,input,select,[role="radio"],[role="tab"],[role="switch"]')].filter(vis);
  const small = ctrls.filter((el) => { const r = el.getBoundingClientRect(); return r.width < 44 || r.height < 44; });
  return {
    textCount: items.length,
    failing: items.filter((i) => i.ratio < i.need),
    minRatio: items.length ? Math.min(...items.map((i) => i.ratio)) : null,
    controls: ctrls.length,
    unnamed: ctrls.filter((el) => !name(el)).length,
    under44: small.map((el) => { const r = el.getBoundingClientRect();
      return { name: name(el).slice(0,26), w: Math.round(r.width), h: Math.round(r.height) }; }),
  };
}`;
