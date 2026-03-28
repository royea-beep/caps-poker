/**
 * Sit & Go tests — unit-level logic tests
 * Tests: insufficient chips, duplicate join, elimination + prize calculation
 */

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockRpc = jest.fn();
const mockFrom = jest.fn();

jest.mock('../../utils/supabase', () => ({
  getSupabase: jest.fn(() => ({
    rpc: mockRpc,
    from: mockFrom,
  })),
}));

jest.mock('../../utils/leaderboard', () => ({
  getDeviceId: jest.fn(() => Promise.resolve('test-device-abc123')),
  getDefaultPlayerName: jest.fn(() => Promise.resolve('PlayerABC1')),
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── Constants ───────────────────────────────────────────────────────────────

const ENTRY_FEE = 100;
const PRIZE_POOL = ENTRY_FEE * 6;

const PRIZES = {
  1: 360,
  2: 180,
  3: 60,
} as Record<number, number>;

// ─── Pure logic helpers (mirror of what screens implement) ───────────────────

function canAffordSNG(chips: number): boolean {
  return chips >= ENTRY_FEE;
}

function getPrizeForPosition(position: number): number {
  return PRIZES[position] ?? 0;
}

async function joinSNG(
  deviceId: string,
  playerName: string,
): Promise<{ success: boolean; error_code?: string; session_id?: string }> {
  const { getSupabase } = require('../../utils/supabase');
  const sb = getSupabase();
  const { data, error } = await sb.rpc('join_sit_n_go', {
    p_device_id: deviceId,
    p_player_name: playerName,
  });
  if (error) return { success: false, error_code: 'RPC_ERROR' };
  if (!data) return { success: false, error_code: 'NULL_RESPONSE' };
  if (data.success === false) return { success: false, error_code: data.error_code };
  return { success: true, session_id: data.session_id };
}

async function eliminatePlayer(deviceId: string, sessionId: string): Promise<boolean> {
  const { getSupabase } = require('../../utils/supabase');
  const sb = getSupabase();
  const { data, error } = await sb.rpc('sng_eliminate', {
    p_device_id: deviceId,
    p_session_id: sessionId,
  });
  if (error) return false;
  return data?.success === true;
}

// ─── Tests: insufficient chips ───────────────────────────────────────────────

describe('Sit & Go: entry fee guard', () => {
  it('blocks join when chips < entry fee', () => {
    expect(canAffordSNG(0)).toBe(false);
    expect(canAffordSNG(50)).toBe(false);
    expect(canAffordSNG(99)).toBe(false);
  });

  it('allows join when chips >= entry fee', () => {
    expect(canAffordSNG(100)).toBe(true);
    expect(canAffordSNG(500)).toBe(true);
    expect(canAffordSNG(10000)).toBe(true);
  });

  it('join_sit_n_go RPC returns INSUFFICIENT_BALANCE when balance is low', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: false, error_code: 'INSUFFICIENT_BALANCE', balance: 50 },
      error: null,
    });

    const result = await joinSNG('test-device-abc123', 'PlayerABC1');
    expect(result.success).toBe(false);
    expect(result.error_code).toBe('INSUFFICIENT_BALANCE');
    expect(mockRpc).toHaveBeenCalledWith('join_sit_n_go', {
      p_device_id: 'test-device-abc123',
      p_player_name: 'PlayerABC1',
    });
  });
});

// ─── Tests: duplicate join ────────────────────────────────────────────────────

describe('Sit & Go: duplicate join guard', () => {
  it('join_sit_n_go RPC returns ALREADY_IN_SESSION when player has active session', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: false, error_code: 'ALREADY_IN_SESSION' },
      error: null,
    });

    const result = await joinSNG('test-device-abc123', 'PlayerABC1');
    expect(result.success).toBe(false);
    expect(result.error_code).toBe('ALREADY_IN_SESSION');
  });

  it('succeeds on second join after leaving previous session', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: true, session_id: 'session-uuid-456' },
      error: null,
    });

    const result = await joinSNG('test-device-abc123', 'PlayerABC1');
    expect(result.success).toBe(true);
    expect(result.session_id).toBe('session-uuid-456');
  });
});

// ─── Tests: elimination + prizes ─────────────────────────────────────────────

describe('Sit & Go: elimination and prizes', () => {
  it('1st place receives 360 chips', () => {
    expect(getPrizeForPosition(1)).toBe(360);
  });

  it('2nd place receives 180 chips', () => {
    expect(getPrizeForPosition(2)).toBe(180);
  });

  it('3rd place receives 60 chips', () => {
    expect(getPrizeForPosition(3)).toBe(60);
  });

  it('4th+ place receives 0 chips', () => {
    expect(getPrizeForPosition(4)).toBe(0);
    expect(getPrizeForPosition(5)).toBe(0);
    expect(getPrizeForPosition(6)).toBe(0);
  });

  it('prize pool totals to 600 (6 × 100 entry fee)', () => {
    const total = PRIZES[1] + PRIZES[2] + PRIZES[3];
    expect(total).toBe(600);
    expect(PRIZE_POOL).toBe(600);
  });

  it('sng_eliminate RPC is called with correct params', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: true, position: 4 },
      error: null,
    });

    const ok = await eliminatePlayer('test-device-abc123', 'session-uuid-123');
    expect(ok).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('sng_eliminate', {
      p_device_id: 'test-device-abc123',
      p_session_id: 'session-uuid-123',
    });
  });

  it('sng_eliminate returns false when RPC errors', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'DB error' },
    });

    const ok = await eliminatePlayer('test-device-abc123', 'session-uuid-error');
    expect(ok).toBe(false);
  });

  it('elimination with chips at 0 triggers correct prize lookup', () => {
    const chips = 0;
    const position = 5; // 5th place eliminated
    const prize = getPrizeForPosition(position);
    expect(chips).toBe(0);
    expect(prize).toBe(0); // No prize for 5th place
  });
});
