/**
 * THE LISTING COPY IS PARSED FROM THE PACK, SO THE PARSE IS THE THING THAT CAN BREAK.
 *
 * `tools/asc/listing_copy.rb` reads docs/listing/LISTING-PACK-2026-09-08.md at runtime and hands
 * the strings straight to a PATCH against Roye's live App Store listing. That is the right shape —
 * one source of truth, no retyped second copy to drift — but it moves the risk: an edit to the
 * pack's markdown can silently change, reorder or truncate what Apple is sent.
 *
 * So this test re-derives every field from the same file, by the same rules, and pins it:
 *   · each fenced block still starts with the text the writer addresses it by;
 *   · every field is inside Apple's character limit;
 *   · the description is UNWRAPPED — the pack hard-wraps at ~100 columns for reading, and Apple
 *     renders a description literally, so a leaked wrap newline would appear mid-sentence on the
 *     store page. The assertion below is that no line ends mid-sentence.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const PACK = join(__dirname, '..', 'docs', 'listing', 'LISTING-PACK-2026-09-08.md');
const md = readFileSync(PACK, 'utf8');

const blocks = [...md.matchAll(/```\n([\s\S]*?)\n```/g)].map((m) => m[1]);

// The same unwrap rule as listing_copy.rb: blank lines, "•" bullets and ALL-CAPS headings keep
// their own line; everything else is rejoined.
function unwrap(text: string): string {
  const out: string[] = [];
  let cur: string | null = null;
  const HEADING = /^[A-Z0-9 ,'’&-]+$/;
  const flush = () => {
    if (cur !== null) out.push(cur);
    cur = null;
  };
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (line.trim() === '') {
      flush();
      out.push('');
    } else if (line.startsWith('•')) {
      flush();
      cur = line;
    } else if (HEADING.test(line.trim())) {
      flush();
      out.push(line.trim());
    } else {
      cur = cur === null ? line.trim() : `${cur} ${line.trim()}`;
    }
  }
  flush();
  return out.join('\n').trim();
}

const LIMITS: Record<string, number> = {
  description: 4000,
  keywords: 100,
  'promotional-text': 170,
  subtitle: 30,
  name: 30,
  "whats-new": 4000,
};

describe('the App Store listing copy the writer will send', () => {
  it('addresses each fenced block by content, not only by position', () => {
    expect(blocks[0].trim().startsWith('CAPS is multi-board poker.')).toBe(true);
    expect(blocks[1].trim().startsWith('Four cards on every board.')).toBe(true);
    expect(blocks[2].trim().startsWith('multiboard,omaha')).toBe(true);
    expect(blocks[3].trim().startsWith('• A new look for the table')).toBe(true);
    expect(blocks[4].trim()).toBe('https://caps.ftable.co.il/privacy.html');
  });

  it('keeps every field inside Apple’s character limit', () => {
    const values: Record<string, string> = {
      description: unwrap(blocks[0]),
      'promotional-text': blocks[1].trim(),
      keywords: blocks[2].trim(),
      'whats-new': blocks[3].trim(),
      subtitle: (md.match(/\*\*Subtitle \(30 max\):\*\* `([^`]+)`/) || [])[1],
      name: (md.match(/\*\*Name \(30 max\):\*\* `([^`]+)`/) || [])[1],
    };
    for (const [field, limit] of Object.entries(LIMITS)) {
      expect(typeof values[field]).toBe('string');
      expect(values[field].length).toBeGreaterThan(0);
      expect(values[field].length).toBeLessThanOrEqual(limit);
    }
    expect(values.subtitle).toBe('Multi-board poker, free');
    // ⚠️ The listing name is the one field the product contradicted itself on: the store said
    // "CAPS - Card game" while the icon, the home masthead and the landing page all say CAPS POKER.
    expect(values.name).toBe('CAPS Poker');
  });

  it('unwraps the description so no line ends mid-sentence', () => {
    const desc = unwrap(blocks[0]);
    const bad = desc
      .split('\n')
      .filter((l) => l.trim() !== '')
      // A section heading is a whole line by design; everything else is a sentence and must
      // end on punctuation. A leftover wrap ends on a word.
      .filter((l) => !/^[A-Z0-9 ,'’&-]+$/.test(l.trim()))
      .filter((l) => !/[.!?:]$/.test(l.trim()));
    expect(bad).toEqual([]);
    // and the wrap really was collapsed — the pack's own text is longer in line count
    expect(desc.split('\n').length).toBeLessThan(blocks[0].split('\n').length);
  });

  it('keeps the deliberate line breaks: bullets and section headings survive', () => {
    const desc = unwrap(blocks[0]);
    expect(desc).toContain('\nHOW A HAND WORKS\n');
    expect(desc).toContain('\nWHAT YOU GET\n');
    expect(desc.split('\n').filter((l) => l.startsWith('•')).length).toBe(9);
  });

  it('promises nothing the product cannot keep', () => {
    const all = blocks.slice(0, 4).join('\n').toLowerCase();
    // measured facts: payments are off, no room has ever reached `playing`, battle pass redirects
    expect(all).not.toContain('battle pass');
    expect(all).not.toContain('tournament');
    expect(all).not.toMatch(/buy chips|purchase chips|real money prizes/);
    // and it must carry the social-casino disclaimer Apple expects
    expect(unwrap(blocks[0])).toContain('no real-money gambling');
  });
});
