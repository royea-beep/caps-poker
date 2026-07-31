/**
 * practiceLiveSession — coordinator logic (pure Jest, realtime layer mocked).
 *
 * Covers the paths a single browser client cannot exercise (they need a 2nd real device):
 * the 30s countdown broadcast, the host cut-and-jump, the joiner-left cancel (edge d),
 * the guest countdown/jump via broadcast, immediate-jump requests, and clean teardown.
 */

// Shared handles to the last-created mock instances. Must be `mock`-prefixed so Jest allows
// referencing them inside the hoisted jest.mock factory below.
const mockRefs: { server: any; client: any } = { server: null, client: null };

jest.mock('../realtimeMultiplayer', () => {
  class MockServer {
    presenceHandler: ((p: { id: string; name: string }[]) => void) | null = null;
    callbacks: any = {};
    broadcastToAll = jest.fn();
    startGame = jest.fn();
    getDealtCards = jest.fn(() => ({
      boards: [{ openCards: [], closedCards: [] }],
      playerHands: [[{ id: 'c1' }], [{ id: 'c2' }]],
    }));
    getClients = jest.fn(() => []);
    updateCallbacks = jest.fn((cb: any) => Object.assign(this.callbacks, cb));
    onPresenceChange = jest.fn((h: any) => { this.presenceHandler = h; });
    start = jest.fn(async () => true);
    stop = jest.fn();
    constructor() { mockRefs.server = this; }
  }
  class MockClient {
    callbacks: any = {};
    presenceHandler: any = null;
    updateCallbacks = jest.fn((cb: any) => Object.assign(this.callbacks, cb));
    onPresenceChange = jest.fn((h: any) => { this.presenceHandler = h; });
    connect = jest.fn(async () => true);
    disconnect = jest.fn();
    constructor() { mockRefs.client = this; }
  }
  return { RealtimeServer: MockServer, RealtimeClient: MockClient, isOnlineMultiplayerAvailable: () => true };
});

jest.mock('../lobbyApi', () => ({
  // NOTE: no joinTable mock. This module does not call joinTable — the seat is held by the CALLER
  // (app/lobby/index.tsx) before beginPracticeLive runs. A mock here previously kept a dead import
  // alive and made the module look like a joinTable caller in greps; it is not one.
  leaveTable: jest.fn(async () => {}),
  touchRoomPlayer: jest.fn(async () => {}),
}));

jest.mock('../leaderboard', () => ({ getDeviceId: jest.fn(async () => 'dev-1') }));

jest.mock('../supabase', () => ({
  getSupabase: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } }),
}));

jest.mock('../economy', () => ({ getMatchCost: () => 0, canAffordMatch: () => true }));

jest.mock('../../constants/economyConfig', () => ({ ECONOMY_FLAGS: { matchCostEnabled: false } }));

jest.mock('../analytics', () => ({ track: jest.fn() }));

// Flag is FALSE in production (shipped dormant); force it ON here so these tests exercise
// the coordinator logic that a 2-device pass will later verify end-to-end.
jest.mock('../../constants/featureFlags', () => ({ PRACTICE_LIVE_ENABLED: true }));

const mockStoreState: any = {
  config: { potPerBoard: 25, numberOfPlayers: 2 },
  chips: 5000,
  setRoomCode: jest.fn(),
  setMpServer: jest.fn(),
  setMpClient: jest.fn(),
  setMultiplayerMode: jest.fn(),
  setConnectedPlayers: jest.fn(),
  resetMultiplayer: jest.fn(),
  resetPracticeSessionNet: jest.fn(),
  updateConfig: jest.fn((partial: any) => Object.assign(mockStoreState.config, partial)),
};
jest.mock('../../store/gameStore', () => ({ useGameStore: { getState: () => mockStoreState } }));

import * as PLS from '../practiceLiveSession';
import * as lobbyApi from '../lobbyApi';

const HOST = { id: 'dev-1', name: 'Host' };
const GUEST = { id: 'dev-2', name: 'Guest' };

async function beginHost() {
  const events: any[] = [];
  const unsub = PLS.subscribePracticeLive((e) => events.push(e));
  const ok = await PLS.beginPracticeLive({ roomCode: 'Z8VM', isHost: true, playerName: 'Host' });
  return { events, unsub, ok };
}

describe('practiceLiveSession — host countdown + jump', () => {
  beforeEach(() => { jest.clearAllMocks(); jest.useRealTimers(); });
  afterEach(async () => { await PLS.endPracticeLive('test-cleanup'); });

  it('holds the seat: joins the room and starts the realtime server as host', async () => {
    const { ok } = await beginHost();
    expect(ok).toBe(true);
    expect(mockRefs.server.start).toHaveBeenCalledWith('Z8VM', 'Host');
    expect(mockStoreState.setMpServer).toHaveBeenCalled();
    expect(PLS.getPracticeLiveState().phase).toBe('holding');
  });

  it('broadcasts a 30s countdown when a 2nd real player joins', async () => {
    const { events } = await beginHost();
    mockRefs.server.presenceHandler([HOST, GUEST]);
    const call = mockRefs.server.broadcastToAll.mock.calls.find((c: any[]) => c[0] === 'JUMP_COUNTDOWN');
    expect(call).toBeTruthy();
    expect(typeof call[1].deadline).toBe('number');
    expect(events.some((e) => e.kind === 'countdown')).toBe(true);
    expect(PLS.getPracticeLiveState().phase).toBe('countdown');
  });

  it('requestJumpNow during a countdown starts the live game and emits a host jump', async () => {
    const { events } = await beginHost();
    mockRefs.server.presenceHandler([HOST, GUEST]);
    PLS.requestPracticeLiveJumpNow();
    expect(mockRefs.server.startGame).toHaveBeenCalled();
    expect(mockStoreState.resetPracticeSessionNet).toHaveBeenCalled(); // demo counter discarded
    const jump: any = events.find((e) => e.kind === 'jump');
    expect(jump).toBeTruthy();
    expect(jump.params.isHost).toBe('true');
    expect(jump.params.playerCount).toBe('2');
    expect(PLS.getPracticeLiveState().phase).toBe('jumping');
  });

  it('auto-jumps at the deadline (30s) if no earlier hand boundary', async () => {
    jest.useFakeTimers();
    const events: any[] = [];
    PLS.subscribePracticeLive((e) => events.push(e));
    await PLS.beginPracticeLive({ roomCode: 'Z8VM', isHost: true, playerName: 'Host' });
    mockRefs.server.presenceHandler([HOST, GUEST]);
    jest.advanceTimersByTime(30_000);
    expect(mockRefs.server.startGame).toHaveBeenCalled();
    expect(events.some((e) => e.kind === 'jump')).toBe(true);
  });

  it('edge d — cancels the countdown when the joiner leaves before the deadline', async () => {
    const { events } = await beginHost();
    mockRefs.server.presenceHandler([HOST, GUEST]); // countdown
    mockRefs.server.presenceHandler([HOST]); // joiner left
    expect(mockRefs.server.broadcastToAll.mock.calls.some((c: any[]) => c[0] === 'JUMP_CANCELLED')).toBe(true);
    expect(events.some((e) => e.kind === 'cancelled')).toBe(true);
    expect(mockRefs.server.startGame).not.toHaveBeenCalled();
    expect(PLS.getPracticeLiveState().phase).toBe('holding');
  });

  it('requestJumpNow is a no-op when no countdown is running', async () => {
    await beginHost();
    PLS.requestPracticeLiveJumpNow();
    expect(mockRefs.server.startGame).not.toHaveBeenCalled();
  });
});

describe('practiceLiveSession — guest', () => {
  beforeEach(() => { jest.clearAllMocks(); jest.useRealTimers(); });
  afterEach(async () => { await PLS.endPracticeLive('test-cleanup'); });

  it('renders the host countdown and jumps on the host deal', async () => {
    const events: any[] = [];
    PLS.subscribePracticeLive((e) => events.push(e));
    await PLS.beginPracticeLive({ roomCode: 'Z8VM', isHost: false, playerName: 'Guest' });
    expect(mockRefs.client.connect).toHaveBeenCalledWith('Z8VM', 'Guest');

    mockRefs.client.callbacks.onJumpCountdown(Date.now() + 30_000);
    expect(events.some((e) => e.kind === 'countdown')).toBe(true);

    mockRefs.client.callbacks.onCardsDealt({ playerIndex: 1, playerCount: 2, yourCards: [{ id: 'g1' }], boards: [] });
    const jump: any = events.find((e) => e.kind === 'jump');
    expect(jump).toBeTruthy();
    expect(jump.params.isHost).toBe('false');
    expect(mockStoreState.resetPracticeSessionNet).toHaveBeenCalled();
  });

  it('clears the countdown when the host cancels', async () => {
    const events: any[] = [];
    PLS.subscribePracticeLive((e) => events.push(e));
    await PLS.beginPracticeLive({ roomCode: 'Z8VM', isHost: false, playerName: 'Guest' });
    mockRefs.client.callbacks.onJumpCountdown(Date.now() + 30_000);
    mockRefs.client.callbacks.onJumpCancelled();
    expect(PLS.getPracticeLiveState().phase).toBe('holding');
  });
});

describe('practiceLiveSession — teardown', () => {
  beforeEach(() => { jest.clearAllMocks(); jest.useRealTimers(); });

  it('frees the DB seat and returns to idle on end', async () => {
    await PLS.beginPracticeLive({ roomCode: 'Z8VM', isHost: true, playerName: 'Host' });
    await PLS.endPracticeLive('exit');
    expect(lobbyApi.leaveTable).toHaveBeenCalled();
    expect(mockRefs.server.stop).toHaveBeenCalled();
    expect(PLS.getPracticeLiveState().phase).toBe('idle');
    expect(PLS.isPracticeLiveActive()).toBe(false);
  });

  it('does NOT tear down realtime after a launch (the game screen owns it)', async () => {
    await PLS.beginPracticeLive({ roomCode: 'Z8VM', isHost: true, playerName: 'Host' });
    PLS.markPracticeLiveLaunched();
    await PLS.endPracticeLive('post-jump');
    expect(lobbyApi.leaveTable).not.toHaveBeenCalled();
    expect(mockRefs.server.stop).not.toHaveBeenCalled();
  });
});
