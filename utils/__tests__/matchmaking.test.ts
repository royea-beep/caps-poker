/**
 * Matchmaking tests.
 * Tests pure logic paths without complex Supabase chain mocking.
 */

jest.mock('../realtimeMultiplayer', () => ({
  generateOnlineRoomCode: () => '123456',
}));

// Build a reusable query builder that resolves with configurable values
function makeQueryBuilder(singleValue: any, limitValue?: any) {
  const qb: any = {
    insert: jest.fn(),
    select: jest.fn(),
    update: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    single: jest.fn(),
  };
  // All chaining methods return the same qb (except terminal ones)
  qb.insert.mockImplementation(() => qb);
  qb.select.mockImplementation(() => qb);
  qb.update.mockImplementation(() => qb);
  qb.eq.mockImplementation(() => qb);
  qb.order.mockImplementation(() => qb);
  qb.limit.mockResolvedValue(limitValue ?? { data: [], error: null });
  qb.single.mockResolvedValue(singleValue);
  return qb;
}

let currentQb: ReturnType<typeof makeQueryBuilder>;

jest.mock('../supabase', () => ({
  getSupabase: () => ({ from: () => currentQb }),
  isSupabaseConfigured: true,
}));

import { createRoom, joinRoom, quickMatch } from '../matchmaking';

const MOCK_CONFIG = {
  numberOfPlayers: 2,
  startingChips: 1000,
  potPerBoard: 50,
} as any;

describe('createRoom', () => {
  it('returns roomCode 123456 and sessionId sess-1', async () => {
    currentQb = makeQueryBuilder({ data: { id: 'sess-1' }, error: null });
    const result = await createRoom('Alice', MOCK_CONFIG);
    expect(result.roomCode).toBe('123456');
    expect(result.sessionId).toBe('sess-1');
  });

  it('throws when Supabase insert returns error', async () => {
    currentQb = makeQueryBuilder({ data: null, error: { message: 'DB error' } });
    await expect(createRoom('Alice', MOCK_CONFIG)).rejects.toThrow('DB error');
  });
});

describe('joinRoom', () => {
  it('throws "Room not found" when Supabase returns null', async () => {
    currentQb = makeQueryBuilder({ data: null, error: { message: 'no rows' } });
    await expect(joinRoom('999999', 'Bob', 1000)).rejects.toThrow('Room not found');
  });

  it('throws "Room is full" when current_players >= max_players', async () => {
    currentQb = makeQueryBuilder({
      data: { id: 'sess-1', room_code: '123456', current_players: 4, max_players: 4, status: 'waiting', host_id: 'Alice' },
      error: null,
    });
    await expect(joinRoom('123456', 'Bob', 1000)).rejects.toThrow('Room is full');
  });
});

describe('quickMatch', () => {
  it('creates a new room when no waiting rooms are available', async () => {
    // First call: listWaitingRooms → empty array
    // Second call: createRoom insert → returns session id
    let callCount = 0;
    const qb: any = {
      insert: jest.fn().mockImplementation(() => qb),
      select: jest.fn().mockImplementation(() => qb),
      update: jest.fn().mockImplementation(() => qb),
      eq: jest.fn().mockImplementation(() => qb),
      order: jest.fn().mockImplementation(() => qb),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      single: jest.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({ data: { id: `sess-${callCount}` }, error: null });
      }),
    };
    currentQb = qb;
    const result = await quickMatch('Charlie', MOCK_CONFIG);
    expect(result.roomCode).toBe('123456');
    expect(result.sessionId).toBeDefined();
  });
});

describe('listWaitingRooms', () => {
  it('returns empty array when Supabase has no rooms', async () => {
    const { listWaitingRooms } = await import('../matchmaking');
    currentQb = makeQueryBuilder(null, { data: [], error: null });
    const rooms = await listWaitingRooms();
    expect(Array.isArray(rooms)).toBe(true);
    expect(rooms).toHaveLength(0);
  });
});
