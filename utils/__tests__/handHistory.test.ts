/**
 * handHistory.test.ts — unit tests for hand history storage
 */
import { saveHandToHistory, getHandHistory, getHand, clearHandHistory, HandRecord } from '../handHistory';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';

const mockGet = AsyncStorage.getItem as jest.Mock;
const mockSet = AsyncStorage.setItem as jest.Mock;
const mockRemove = AsyncStorage.removeItem as jest.Mock;

function makeHand(id: string, netChips = 50): HandRecord {
  return {
    id,
    timestamp: Date.now(),
    boards: [
      {
        boardIndex: 0,
        winner: 'player',
        playerHandName: 'Flush',
        botHandName: 'Pair',
        playerCards: [
          { rank: 'A', suit: 'hearts' },
          { rank: 'K', suit: 'hearts' },
          { rank: 'Q', suit: 'hearts' },
          { rank: 'J', suit: 'hearts' },
        ],
        botCards: [
          { rank: '2', suit: 'clubs' },
          { rank: '3', suit: 'clubs' },
          { rank: '4', suit: 'clubs' },
          { rank: '5', suit: 'clubs' },
        ],
        communityCards: [
          { rank: '9', suit: 'hearts' },
          { rank: '8', suit: 'hearts' },
          { rank: '7', suit: 'hearts' },
          { rank: '6', suit: 'diamonds' },
          { rank: '5', suit: 'spades' },
        ],
      },
    ],
    netChips,
    potPerBoard: 100,
    numberOfPlayers: 2,
    boardCount: 1,
    isComplete: false,
    completeBonusAmount: 0,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('saveHandToHistory', () => {
  it('saves a hand when history is empty', async () => {
    mockGet.mockResolvedValue(null);
    mockSet.mockResolvedValue(undefined);

    const hand = makeHand('hand-1');
    await saveHandToHistory(hand);

    expect(mockSet).toHaveBeenCalledTimes(1);
    const [key, value] = mockSet.mock.calls[0];
    expect(key).toBe('caps_hand_history');
    const saved: HandRecord[] = JSON.parse(value);
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe('hand-1');
  });

  it('prepends new hands (newest first)', async () => {
    const existing = [makeHand('hand-1')];
    mockGet.mockResolvedValue(JSON.stringify(existing));
    mockSet.mockResolvedValue(undefined);

    await saveHandToHistory(makeHand('hand-2'));

    const [, value] = mockSet.mock.calls[0];
    const saved: HandRecord[] = JSON.parse(value);
    expect(saved[0].id).toBe('hand-2');
    expect(saved[1].id).toBe('hand-1');
  });

  it('enforces max 50 hands limit (drops oldest)', async () => {
    // Create 50 existing hands
    const existing: HandRecord[] = Array.from({ length: 50 }, (_, i) =>
      makeHand(`hand-${i}`)
    );
    mockGet.mockResolvedValue(JSON.stringify(existing));
    mockSet.mockResolvedValue(undefined);

    await saveHandToHistory(makeHand('hand-new'));

    const [, value] = mockSet.mock.calls[0];
    const saved: HandRecord[] = JSON.parse(value);
    expect(saved).toHaveLength(50);
    expect(saved[0].id).toBe('hand-new');
    // The oldest (hand-49) should be dropped
    expect(saved.find((h) => h.id === 'hand-49')).toBeUndefined();
  });

  it('silently fails on AsyncStorage error', async () => {
    mockGet.mockRejectedValue(new Error('storage error'));
    // Should not throw
    await expect(saveHandToHistory(makeHand('hand-1'))).resolves.toBeUndefined();
  });
});

describe('getHandHistory', () => {
  it('returns empty array when no history', async () => {
    mockGet.mockResolvedValue(null);
    const result = await getHandHistory();
    expect(result).toEqual([]);
  });

  it('returns parsed history', async () => {
    const history = [makeHand('hand-1'), makeHand('hand-2')];
    mockGet.mockResolvedValue(JSON.stringify(history));
    const result = await getHandHistory();
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('hand-1');
  });

  it('returns empty array on error', async () => {
    mockGet.mockRejectedValue(new Error('fail'));
    const result = await getHandHistory();
    expect(result).toEqual([]);
  });
});

describe('getHand', () => {
  it('returns the correct hand by id', async () => {
    const history = [makeHand('hand-1'), makeHand('hand-2'), makeHand('hand-3')];
    mockGet.mockResolvedValue(JSON.stringify(history));
    const result = await getHand('hand-2');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('hand-2');
  });

  it('returns null when id not found', async () => {
    const history = [makeHand('hand-1')];
    mockGet.mockResolvedValue(JSON.stringify(history));
    const result = await getHand('nonexistent');
    expect(result).toBeNull();
  });

  it('returns null on error', async () => {
    mockGet.mockRejectedValue(new Error('fail'));
    const result = await getHand('hand-1');
    expect(result).toBeNull();
  });
});

describe('clearHandHistory', () => {
  it('calls removeItem with correct key', async () => {
    mockRemove.mockResolvedValue(undefined);
    await clearHandHistory();
    expect(mockRemove).toHaveBeenCalledWith('caps_hand_history');
  });

  it('silently fails on error', async () => {
    mockRemove.mockRejectedValue(new Error('fail'));
    await expect(clearHandHistory()).resolves.toBeUndefined();
  });
});
