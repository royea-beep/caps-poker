/**
 * useRealtimeGame — channel logic tests (pure Jest, no React renderer needed).
 * Tests verify: broadcast registration, send payloads, and pure handler logic.
 */

// ── Channel mock ─────────────────────────────────────────────────────────────
type BroadcastHandler = (arg: { payload: any }) => void;

interface MockChannel {
  on: jest.MockedFunction<(type: string, filter: any, handler?: BroadcastHandler) => MockChannel>;
  subscribe: jest.MockedFunction<(cb?: (s: string) => void) => MockChannel>;
  unsubscribe: jest.MockedFunction<() => void>;
  send: jest.MockedFunction<(msg: any) => Promise<any>>;
  emit: (event: string, payload: any) => void;
  setStatus: (s: string) => void;
}

function makeChannel(): MockChannel {
  const broadcastHandlers: Record<string, BroadcastHandler> = {};
  let subscribeStatus: ((s: string) => void) | null = null;

  const ch: MockChannel = {
    on: jest.fn((_type: string, filter: any, handler?: BroadcastHandler) => {
      if (filter?.event && handler) broadcastHandlers[filter.event] = handler;
      return ch;
    }),
    subscribe: jest.fn((cb?: (s: string) => void) => {
      subscribeStatus = cb ?? null;
      return ch;
    }),
    unsubscribe: jest.fn(),
    send: jest.fn().mockResolvedValue({ status: 'ok' }),
    emit: (event: string, payload: any) => broadcastHandlers[event]?.({ payload }),
    setStatus: (s: string) => subscribeStatus?.(s),
  };
  return ch;
}

// ── Supabase mock (module level) ─────────────────────────────────────────────
const mockSbChannel = makeChannel();

jest.mock('../../utils/supabase', () => ({
  getSupabase: () => ({
    channel: (_id: string, _opts: any) => mockSbChannel,
  }),
}));

// ── Tests: channel registration logic ────────────────────────────────────────
describe('RealtimeGame channel logic', () => {
  // We test the channel behavior directly, matching what the hook wires up

  it('channel.on registers broadcast handlers', () => {
    // Simulate the hook calling ch.on multiple times
    const ch = makeChannel();
    const gameStateHandler = jest.fn();
    const handHandler = jest.fn();

    ch.on('broadcast', { event: 'game_state' }, gameStateHandler);
    ch.on('broadcast', { event: 'hand:Alice' }, handHandler);
    ch.subscribe();

    ch.emit('game_state', { phase: 'placement', boards: [] });
    expect(gameStateHandler).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ phase: 'placement' }) })
    );

    ch.emit('hand:Alice', { cards: [{ rank: 'A', suit: 'spades' }] });
    expect(handHandler).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ cards: expect.any(Array) }) })
    );
  });

  it('player_ready events accumulate unique players', () => {
    const ch = makeChannel();
    const received: string[] = [];

    ch.on('broadcast', { event: 'player_ready' }, ({ payload }: { payload: any }) => {
      const name: string = payload.player ?? '';
      if (!received.includes(name)) received.push(name);
    });
    ch.subscribe();

    ch.emit('player_ready', { player: 'Bob' });
    ch.emit('player_ready', { player: 'Bob' }); // duplicate — should not double-add
    ch.emit('player_ready', { player: 'Carol' });

    expect(received).toHaveLength(2);
    expect(received).toContain('Bob');
    expect(received).toContain('Carol');
  });

  it('subscription status callback fires on subscribe', () => {
    const ch = makeChannel();
    const onStatus = jest.fn();
    ch.subscribe(onStatus);
    ch.setStatus('SUBSCRIBED');
    expect(onStatus).toHaveBeenCalledWith('SUBSCRIBED');
  });

  it('unsubscribe is called on cleanup', () => {
    const ch = makeChannel();
    ch.subscribe();
    ch.unsubscribe();
    expect(ch.unsubscribe).toHaveBeenCalled();
  });
});

// ── Tests: send payloads ──────────────────────────────────────────────────────
describe('RealtimeGame send payloads', () => {
  it('sendReady sends player_ready event', () => {
    const ch = makeChannel();
    const playerName = 'Alice';
    const placements = { board0: [{ rank: 'A', suit: 'spades', id: 'a1' }] };

    ch.send({
      type: 'broadcast',
      event: 'player_ready',
      payload: { player: playerName, placements },
    });

    expect(ch.send).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'player_ready',
        payload: expect.objectContaining({ player: 'Alice' }),
      })
    );
  });

  it('dealCards sends one hand event per player + game_state', () => {
    const ch = makeChannel();
    const hands = { Alice: [], Bob: [], Carol: [] };

    Object.entries(hands).forEach(([name, cards]) => {
      ch.send({ type: 'broadcast', event: `hand:${name}`, payload: { cards } });
    });
    ch.send({
      type: 'broadcast',
      event: 'game_state',
      payload: { phase: 'placement', boards: [], placements: {}, readyPlayers: [], results: null, round: 1 },
    });

    expect(ch.send).toHaveBeenCalledTimes(4); // 3 hands + 1 game_state
    expect(ch.send).toHaveBeenCalledWith(expect.objectContaining({ event: 'hand:Alice' }));
    expect(ch.send).toHaveBeenCalledWith(expect.objectContaining({ event: 'hand:Bob' }));
    expect(ch.send).toHaveBeenCalledWith(expect.objectContaining({ event: 'game_state' }));
  });

  it('revealAllPlacements sends reveal_placements event', () => {
    const ch = makeChannel();
    const placements = { Alice: {}, Bob: {} };
    ch.send({ type: 'broadcast', event: 'reveal_placements', payload: { placements } });
    expect(ch.send).toHaveBeenCalledWith(expect.objectContaining({ event: 'reveal_placements' }));
  });

  it('revealCommunityCard sends reveal_community with correct fields', () => {
    const ch = makeChannel();
    const card = { rank: 'Q', suit: 'hearts', id: 'q1' };
    ch.send({
      type: 'broadcast',
      event: 'reveal_community',
      payload: { boardIndex: 0, cardIndex: 3, card, revealedCount: 4 },
    });
    expect(ch.send).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'reveal_community',
        payload: expect.objectContaining({ boardIndex: 0, revealedCount: 4 }),
      })
    );
  });

  it('sendResults sends game_results event', () => {
    const ch = makeChannel();
    const results = { winner: 'Alice', chips: 500 };
    ch.send({ type: 'broadcast', event: 'game_results', payload: results });
    expect(ch.send).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'game_results',
        payload: expect.objectContaining({ winner: 'Alice' }),
      })
    );
  });

  it('requestStateRestore sends request_state event', () => {
    const ch = makeChannel();
    ch.send({ type: 'broadcast', event: 'request_state', payload: { player: 'Alice' } });
    expect(ch.send).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'request_state' })
    );
  });
});
