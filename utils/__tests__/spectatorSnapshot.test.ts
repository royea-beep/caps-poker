import { SpectatorSnapshot } from '../realtimeMultiplayer';

// Helper to build a valid snapshot
function makeSnapshot(overrides: Partial<SpectatorSnapshot> = {}): SpectatorSnapshot {
  return {
    phase: 'arranging',
    boardCount: 2,
    players: [
      { id: 'p1', name: 'Alice', isReady: false },
      { id: 'p2', name: 'Bob', isReady: false },
    ],
    communityCards: [
      [{ rank: 'A', suit: 'hearts' }, { rank: 'K', suit: 'spades' }, { rank: '7', suit: 'clubs' }],
      [{ rank: '2', suit: 'diamonds' }, { rank: '9', suit: 'hearts' }, { rank: 'J', suit: 'spades' }],
    ],
    spectatorCount: 0,
    ...overrides,
  };
}

describe('SpectatorSnapshot structure', () => {
  it('has required fields in arranging phase', () => {
    const s = makeSnapshot();
    expect(s.phase).toBe('arranging');
    expect(s.boardCount).toBe(2);
    expect(s.players).toHaveLength(2);
    expect(s.communityCards).toHaveLength(2);
    expect(s.revealedBoards).toBeUndefined();
  });

  it('player hole cards are NOT present in arranging phase snapshot', () => {
    const s = makeSnapshot({ phase: 'arranging' });
    // Snapshot has no playerCards/holeCards field — confirmed by structure
    expect((s as any).playerCards).toBeUndefined();
    expect((s as any).holeCards).toBeUndefined();
    // Only playerHandName (hand rank) visible in results phase
    s.players.forEach((p) => {
      expect((p as any).cards).toBeUndefined();
    });
  });

  it('includes revealedBoards in results phase', () => {
    const s = makeSnapshot({
      phase: 'results',
      revealedBoards: [
        {
          boardIndex: 0,
          winnerName: 'Alice',
          playerHands: [
            { playerName: 'Alice', handRank: 'Flush' },
            { playerName: 'Bob', handRank: 'One Pair' },
          ],
        },
      ],
    });
    expect(s.phase).toBe('results');
    expect(s.revealedBoards).toHaveLength(1);
    expect(s.revealedBoards![0].winnerName).toBe('Alice');
    expect(s.revealedBoards![0].playerHands[0].handRank).toBe('Flush');
  });

  it('revealedBoards playerHands have no hole cards', () => {
    const s = makeSnapshot({
      phase: 'results',
      revealedBoards: [
        {
          boardIndex: 0,
          winnerName: 'Bob',
          playerHands: [
            { playerName: 'Alice', handRank: 'Two Pair' },
            { playerName: 'Bob', handRank: 'Full House' },
          ],
        },
      ],
    });
    // revealedBoards only has handRank (hand name), NOT the actual cards
    s.revealedBoards!.forEach((rb) => {
      rb.playerHands.forEach((ph) => {
        expect((ph as any).cards).toBeUndefined();
      });
    });
  });

  it('spectatorCount is a number', () => {
    const s = makeSnapshot({ spectatorCount: 3 });
    expect(typeof s.spectatorCount).toBe('number');
    expect(s.spectatorCount).toBe(3);
  });

  it('community cards contain rank and suit only — no hole card info', () => {
    const s = makeSnapshot();
    s.communityCards.forEach((boardCards) => {
      boardCards.forEach((card) => {
        expect(card).toHaveProperty('rank');
        expect(card).toHaveProperty('suit');
        expect((card as any).isPlayerCard).toBeUndefined();
      });
    });
  });

  it('player ready status is visible but card count is not', () => {
    const s = makeSnapshot({
      players: [
        { id: 'p1', name: 'Alice', isReady: true },
        { id: 'p2', name: 'Bob', isReady: false },
      ],
    });
    expect(s.players[0].isReady).toBe(true);
    expect(s.players[1].isReady).toBe(false);
    s.players.forEach((p) => {
      expect((p as any).chipsPlaced).toBeUndefined();
      expect((p as any).boardAssignments).toBeUndefined();
    });
  });

  it('boardCount matches communityCards array length', () => {
    const s = makeSnapshot({ boardCount: 3, communityCards: [[], [], []] });
    expect(s.communityCards).toHaveLength(s.boardCount);
  });
});
