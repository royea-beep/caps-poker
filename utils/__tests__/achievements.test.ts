import { checkAchievements, ACHIEVEMENTS, getAchievement, AchievementCheckContext } from '../achievements';
import { RevealData } from '../../types/gameTypes';

function makeReveal(overrides: Partial<RevealData> = {}): RevealData {
  const boards = overrides.boards ?? [
    { winner: 'player', playerHandName: 'One Pair', botHandName: 'High Card', openCards: [], closedCards: [], playerCards: [], allBotCards: [], allBotHandNames: [], playerHighlightIds: [], botHighlightIds: [], boardHighlightIds: [], potAmount: 100 },
    { winner: 'bot', playerHandName: 'High Card', botHandName: 'One Pair', openCards: [], closedCards: [], playerCards: [], allBotCards: [], allBotHandNames: [], playerHighlightIds: [], botHighlightIds: [], boardHighlightIds: [], potAmount: 100 },
  ];
  return {
    boards,
    netChips: overrides.netChips ?? 50,
    playerChipsWon: overrides.playerChipsWon ?? 100,
    isComplete: overrides.isComplete ?? false,
    completeBonusAmount: overrides.completeBonusAmount ?? 0,
    completeWinner: overrides.completeWinner ?? null,
    boardRevealDuration: 1000,
    completeBonusDisplay: 2000,
    turnRevealDelay: 500,
    potPerBoard: overrides.potPerBoard ?? 100,
    numberOfPlayers: overrides.numberOfPlayers ?? 2,
    boardCount: boards.length,
  };
}

function makeCtx(overrides: Partial<AchievementCheckContext> = {}): AchievementCheckContext {
  return {
    revealData: makeReveal(),
    config: { botDifficulty: 'easy' } as any,
    handsPlayed: 1,
    handsWon: 1,
    currentWinStreak: 1,
    isMultiplayer: false,
    alreadyUnlocked: [],
    ...overrides,
  };
}

describe('ACHIEVEMENTS', () => {
  it('has 12 achievements', () => {
    expect(ACHIEVEMENTS).toHaveLength(12);
  });

  it('getAchievement returns correct entry', () => {
    const a = getAchievement('first_win');
    expect(a?.reward).toBe(100);
  });

  it('returns empty array for unknown id', () => {
    expect(getAchievement('nonexistent')).toBeUndefined();
  });
});

describe('checkAchievements', () => {
  it('unlocks first_win on first win', () => {
    const result = checkAchievements(makeCtx({ handsWon: 1 }));
    expect(result).toContain('first_win');
  });

  it('does not re-unlock already unlocked achievements', () => {
    const result = checkAchievements(makeCtx({ handsWon: 1, alreadyUnlocked: ['first_win'] }));
    expect(result).not.toContain('first_win');
  });

  it('unlocks complete_master when the LOCAL player sweeps all boards', () => {
    // Arrange — isComplete AND every board won by the player (a real local sweep)
    const sweep = makeReveal({
      isComplete: true,
      boards: [
        { winner: 'player', playerHandName: 'One Pair', botHandName: 'High Card', openCards: [], closedCards: [], playerCards: [], allBotCards: [], allBotHandNames: [], playerHighlightIds: [], botHighlightIds: [], boardHighlightIds: [], potAmount: 100 },
        { winner: 'player', playerHandName: 'Two Pair', botHandName: 'High Card', openCards: [], closedCards: [], playerCards: [], allBotCards: [], allBotHandNames: [], playerHighlightIds: [], botHighlightIds: [], boardHighlightIds: [], potAmount: 100 },
      ],
    });
    // Act
    const result = checkAchievements(makeCtx({ revealData: sweep }));
    // Assert
    expect(result).toContain('complete_master');
  });

  it('does NOT unlock complete_master when the OPPONENT swept (local loss)', () => {
    // Arrange — isComplete is true but the LOCAL player won zero boards (opponent swept)
    const opponentSweep = makeReveal({
      isComplete: true,
      netChips: -150,
      boards: [
        { winner: 'bot', playerHandName: 'High Card', botHandName: 'One Pair', openCards: [], closedCards: [], playerCards: [], allBotCards: [], allBotHandNames: [], playerHighlightIds: [], botHighlightIds: [], boardHighlightIds: [], potAmount: 100 },
        { winner: 'bot', playerHandName: 'High Card', botHandName: 'Two Pair', openCards: [], closedCards: [], playerCards: [], allBotCards: [], allBotHandNames: [], playerHighlightIds: [], botHighlightIds: [], boardHighlightIds: [], potAmount: 100 },
      ],
    });
    // Act
    const result = checkAchievements(makeCtx({ revealData: opponentSweep }));
    // Assert — the COMPLETE!+500 reward must NOT unlock for the loser
    expect(result).not.toContain('complete_master');
  });

  it('unlocks streak_3 at streak >= 3', () => {
    const result = checkAchievements(makeCtx({ currentWinStreak: 3 }));
    expect(result).toContain('streak_3');
  });

  it('unlocks streak_7 at streak >= 7', () => {
    const result = checkAchievements(makeCtx({ currentWinStreak: 7 }));
    expect(result).toContain('streak_3');
    expect(result).toContain('streak_7');
  });

  it('unlocks play_10 at 10 hands', () => {
    const result = checkAchievements(makeCtx({ handsPlayed: 10 }));
    expect(result).toContain('play_10');
  });

  it('unlocks hard_mode_win when beating hard bot', () => {
    const result = checkAchievements(makeCtx({ config: { botDifficulty: 'hard' } as any, revealData: makeReveal({ netChips: 100 }) }));
    expect(result).toContain('hard_mode_win');
  });

  it('does NOT unlock hard_mode_win on loss', () => {
    const result = checkAchievements(makeCtx({ config: { botDifficulty: 'hard' } as any, revealData: makeReveal({ netChips: -100 }) }));
    expect(result).not.toContain('hard_mode_win');
  });

  it('unlocks flush_hand when player wins with Flush', () => {
    const flushReveal = makeReveal({
      boards: [{
        winner: 'player', playerHandName: 'Flush', botHandName: 'High Card',
        openCards: [], closedCards: [], playerCards: [], allBotCards: [], allBotHandNames: [],
        playerHighlightIds: [], botHighlightIds: [], boardHighlightIds: [], potAmount: 100,
      }],
    });
    const result = checkAchievements(makeCtx({ revealData: flushReveal }));
    expect(result).toContain('flush_hand');
  });

  it('unlocks royal_flush on any royal flush regardless of win', () => {
    const royalReveal = makeReveal({
      boards: [{
        winner: 'bot', playerHandName: 'Royal Flush', botHandName: 'Straight Flush',
        openCards: [], closedCards: [], playerCards: [], allBotCards: [], allBotHandNames: [],
        playerHighlightIds: [], botHighlightIds: [], boardHighlightIds: [], potAmount: 100,
      }],
    });
    const result = checkAchievements(makeCtx({ revealData: royalReveal }));
    expect(result).toContain('royal_flush');
  });

  it('unlocks online_win for multiplayer win', () => {
    const result = checkAchievements(makeCtx({ isMultiplayer: true, revealData: makeReveal({ netChips: 200 }) }));
    expect(result).toContain('online_win');
  });

  it('unlocks underdog when 1 of 3+ boards won', () => {
    const boards = [
      { winner: 'player' as const, playerHandName: 'One Pair', botHandName: 'High Card', openCards: [], closedCards: [], playerCards: [], allBotCards: [], allBotHandNames: [], playerHighlightIds: [], botHighlightIds: [], boardHighlightIds: [], potAmount: 100 },
      { winner: 'bot' as const, playerHandName: 'High Card', botHandName: 'One Pair', openCards: [], closedCards: [], playerCards: [], allBotCards: [], allBotHandNames: [], playerHighlightIds: [], botHighlightIds: [], boardHighlightIds: [], potAmount: 100 },
      { winner: 'bot' as const, playerHandName: 'High Card', botHandName: 'Two Pair', openCards: [], closedCards: [], playerCards: [], allBotCards: [], allBotHandNames: [], playerHighlightIds: [], botHighlightIds: [], boardHighlightIds: [], potAmount: 100 },
    ];
    const result = checkAchievements(makeCtx({ revealData: makeReveal({ boards }) }));
    expect(result).toContain('underdog');
  });

  it('never throws for any input', () => {
    expect(() => checkAchievements(makeCtx())).not.toThrow();
    expect(() => checkAchievements({ revealData: {} as any, config: {} as any, handsPlayed: 0, handsWon: 0, currentWinStreak: 0, isMultiplayer: false, alreadyUnlocked: [] })).not.toThrow();
  });
});
