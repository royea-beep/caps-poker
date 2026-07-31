// U2 — behavioural: joinTable must return a JoinResult carrying network copy on a transport
// failure, never null. Call sites read `res?.message ?? <their own generic>`, so returning null
// silently reinstates the "your code is wrong" misdiagnosis for an offline player.
jest.mock('../supabase', () => ({ getSupabase: jest.fn(() => null) }));
jest.mock('../auth', () => ({ ensureAnonymousAuth: jest.fn(async () => null) }));
jest.mock('../analytics', () => ({ track: jest.fn() }));

import { joinTable } from '../lobbyApi';
import { JOIN_NETWORK_ERROR, JOIN_NETWORK_MESSAGE } from '../joinIdentity';

describe('joinTable transport failure (U2)', () => {
  it('returns a JoinResult with network copy instead of null when the client is unavailable', async () => {
    const res = await joinTable('Z8VM', null, 'Player', 'test-unit');
    expect(res).not.toBeNull();
    expect(res.ok).toBe(false);
    expect(res.error).toBe(JOIN_NETWORK_ERROR);
    expect(res.message).toBe(JOIN_NETWORK_MESSAGE);
  });

  it('the message a call site would render is the network one, not a table diagnosis', async () => {
    const res = await joinTable('Z8VM', null, 'Player', 'test-unit');
    const rendered = res?.message ?? 'That code is wrong, full, or no longer open.';
    expect(rendered).toBe(JOIN_NETWORK_MESSAGE);
  });
});
