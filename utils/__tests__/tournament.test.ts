import { generateBracket } from '../tournament';

describe('generateBracket (4 players)', () => {
  const players4 = ['A', 'B', 'C', 'D'];

  it('creates exactly 3 matches (2 semis + 1 final)', () => {
    const bracket = generateBracket(players4, 4);
    expect(bracket.matches).toHaveLength(3);
  });

  it('semi-final 1 has player1=A and player2=B', () => {
    const bracket = generateBracket(players4, 4);
    const sf0 = bracket.matches.find((m) => m.id === 'sf_0');
    expect(sf0).toBeDefined();
    expect(sf0!.player1).toBe('A');
    expect(sf0!.player2).toBe('B');
  });

  it('semi-final 2 has player1=C and player2=D', () => {
    const bracket = generateBracket(players4, 4);
    const sf1 = bracket.matches.find((m) => m.id === 'sf_1');
    expect(sf1).toBeDefined();
    expect(sf1!.player1).toBe('C');
    expect(sf1!.player2).toBe('D');
  });

  it('has a final match (round 2) with no players yet', () => {
    const bracket = generateBracket(players4, 4);
    const final = bracket.matches.find((m) => m.id === 'final');
    expect(final).toBeDefined();
    expect(final!.round).toBe(2);
    expect(final!.player1).toBeNull();
    expect(final!.player2).toBeNull();
  });

  it('champion is null initially', () => {
    const bracket = generateBracket(players4, 4);
    expect(bracket.champion).toBeNull();
  });

  it('all match IDs are unique', () => {
    const bracket = generateBracket(players4, 4);
    const ids = bracket.matches.map((m) => m.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('all matches have winner=null initially', () => {
    const bracket = generateBracket(players4, 4);
    for (const match of bracket.matches) {
      expect(match.winner).toBeNull();
    }
  });
});

describe('generateBracket (8 players)', () => {
  const players8 = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  it('creates exactly 7 matches (4 quarters + 2 semis + 1 final)', () => {
    const bracket = generateBracket(players8, 8);
    expect(bracket.matches).toHaveLength(7);
  });

  it('has 4 quarter-final matches (round 1)', () => {
    const bracket = generateBracket(players8, 8);
    const round1 = bracket.matches.filter((m) => m.round === 1);
    expect(round1).toHaveLength(4);
  });

  it('has 2 semi-final matches (round 2)', () => {
    const bracket = generateBracket(players8, 8);
    const round2 = bracket.matches.filter((m) => m.round === 2);
    expect(round2).toHaveLength(2);
  });

  it('has 1 final match (round 3)', () => {
    const bracket = generateBracket(players8, 8);
    const round3 = bracket.matches.filter((m) => m.round === 3);
    expect(round3).toHaveLength(1);
    expect(round3[0].id).toBe('final');
  });

  it('champion is null initially', () => {
    const bracket = generateBracket(players8, 8);
    expect(bracket.champion).toBeNull();
  });

  it('all match IDs are unique within the bracket', () => {
    const bracket = generateBracket(players8, 8);
    const ids = bracket.matches.map((m) => m.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('first quarter-final seeds first two players', () => {
    const bracket = generateBracket(players8, 8);
    const qf0 = bracket.matches.find((m) => m.id === 'qf_0');
    expect(qf0).toBeDefined();
    expect(qf0!.player1).toBe('A');
    expect(qf0!.player2).toBe('B');
  });

  it('last quarter-final seeds players G and H', () => {
    const bracket = generateBracket(players8, 8);
    const qf3 = bracket.matches.find((m) => m.id === 'qf_3');
    expect(qf3).toBeDefined();
    expect(qf3!.player1).toBe('G');
    expect(qf3!.player2).toBe('H');
  });
});

describe('generateBracket — prizes', () => {
  it('prizes.first is chips with amount = players * 200', () => {
    const bracket4 = generateBracket(['A', 'B', 'C', 'D'], 4);
    expect(bracket4.prizes.first.type).toBe('chips');
    expect(bracket4.prizes.first.amount).toBe(4 * 200);
  });

  it('prizes.first for 8-player bracket = 8 * 200', () => {
    const bracket8 = generateBracket(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], 8);
    expect(bracket8.prizes.first.amount).toBe(8 * 200);
  });
});
