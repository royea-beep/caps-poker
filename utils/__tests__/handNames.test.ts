import { getHandName, getComparisonText } from '../handNames';

describe('getHandName', () => {
  it('returns English name unchanged', () => {
    expect(getHandName('Three of a Kind', 'en')).toBe('Three of a Kind');
    expect(getHandName('One Pair', 'en')).toBe('One Pair');
    expect(getHandName('Royal Flush', 'en')).toBe('Royal Flush');
  });

  it('returns Hebrew name for all hand types', () => {
    expect(getHandName('High Card', 'he')).toBe('קלף גבוה');
    expect(getHandName('One Pair', 'he')).toBe('זוג');
    expect(getHandName('Two Pair', 'he')).toBe('שני זוגות');
    expect(getHandName('Three of a Kind', 'he')).toBe('שלישייה');
    expect(getHandName('Straight', 'he')).toBe('רצף');
    expect(getHandName('Flush', 'he')).toBe('צבע');
    expect(getHandName('Full House', 'he')).toBe('פול האוס');
    expect(getHandName('Four of a Kind', 'he')).toBe('רביעייה');
    expect(getHandName('Straight Flush', 'he')).toBe('רצף צבע');
    expect(getHandName('Royal Flush', 'he')).toBe('רויאל פלאש');
  });

  it('falls back to original name for unknown hand', () => {
    expect(getHandName('Unknown Hand', 'en')).toBe('Unknown Hand');
    expect(getHandName('Unknown Hand', 'he')).toBe('Unknown Hand');
  });
});

describe('getComparisonText', () => {
  it('generates English win comparison', () => {
    expect(getComparisonText('Three of a Kind', 'One Pair', 'player', 'en'))
      .toBe('Three of a Kind beats One Pair');
  });

  it('generates English loss comparison', () => {
    expect(getComparisonText('One Pair', 'Flush', 'bot', 'en'))
      .toBe('Flush beats One Pair');
  });

  it('generates tie text', () => {
    expect(getComparisonText('Two Pair', 'Two Pair', 'tie', 'en'))
      .toBe('Tie — Two Pair');
  });

  it('generates Hebrew win comparison', () => {
    expect(getComparisonText('Three of a Kind', 'One Pair', 'player', 'he'))
      .toBe('שלישייה מנצח את זוג');
  });

  it('generates Hebrew loss comparison', () => {
    expect(getComparisonText('One Pair', 'Flush', 'bot', 'he'))
      .toBe('צבע מנצח את זוג');
  });

  it('generates Hebrew tie text', () => {
    expect(getComparisonText('Two Pair', 'Two Pair', 'tie', 'he'))
      .toBe('תיקו — שני זוגות');
  });
});
