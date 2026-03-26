/**
 * Hand name i18n + comparison text utility.
 * Maps English hand names (from HAND_RANK_NAMES) → localized display names.
 */

type Lang = 'en' | 'he';

const HAND_NAME_MAP: Record<string, { en: string; he: string }> = {
  'High Card':       { en: 'High Card',       he: 'קלף גבוה' },
  'One Pair':        { en: 'One Pair',         he: 'זוג' },
  'Two Pair':        { en: 'Two Pair',         he: 'שני זוגות' },
  'Three of a Kind': { en: 'Three of a Kind',  he: 'שלישייה' },
  'Straight':        { en: 'Straight',         he: 'רצף' },
  'Flush':           { en: 'Flush',            he: 'צבע' },
  'Full House':      { en: 'Full House',       he: 'פול האוס' },
  'Four of a Kind':  { en: 'Four of a Kind',   he: 'רביעייה' },
  'Straight Flush':  { en: 'Straight Flush',   he: 'רצף צבע' },
  'Royal Flush':     { en: 'Royal Flush',      he: 'רויאל פלאש' },
};

/** Translate English hand name to display language. Falls back to English. */
export function getHandName(englishName: string, lang: Lang): string {
  return HAND_NAME_MAP[englishName]?.[lang] ?? englishName;
}

/**
 * "Three of a Kind beats One Pair" / "שלישייה מנצח את זוג"
 * winner: 'player' = player won this board, 'bot' = bot won, 'tie' = tie
 */
export function getComparisonText(
  playerHandName: string,
  botHandName: string,
  winner: 'player' | 'bot' | 'tie',
  lang: Lang
): string {
  const p = getHandName(playerHandName, lang);
  const b = getHandName(botHandName, lang);

  if (winner === 'tie') {
    return lang === 'he' ? `תיקו — ${p}` : `Tie — ${p}`;
  }
  if (lang === 'he') {
    return winner === 'player'
      ? `${p} מנצח את ${b}`
      : `${b} מנצח את ${p}`;
  }
  return winner === 'player'
    ? `${p} beats ${b}`
    : `${b} beats ${p}`;
}
