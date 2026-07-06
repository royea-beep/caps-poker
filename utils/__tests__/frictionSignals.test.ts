/**
 * frictionSignals — rage_tap / screen_abandon / stuck_dwell logic, mocked analytics.
 */
const mockTrack = jest.fn();
jest.mock('../analytics', () => ({ track: (...args: any[]) => mockTrack(...args) }));

import { recordGlobalTap, onScreenChanged } from '../frictionSignals';

describe('frictionSignals — rage_tap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(1_000_000);
    onScreenChanged('screen-a'); // reset module-level screen state cleanly between tests
    mockTrack.mockClear();
  });
  afterEach(() => { jest.useRealTimers(); });

  it('fires after 3 taps within a small radius inside 1s', () => {
    recordGlobalTap(100, 100);
    recordGlobalTap(102, 98);
    recordGlobalTap(101, 101);
    expect(mockTrack).toHaveBeenCalledWith('rage_tap', expect.objectContaining({ tapCount: 3 }), 'screen-a');
  });

  it('does NOT fire for only 2 taps', () => {
    recordGlobalTap(100, 100);
    recordGlobalTap(102, 98);
    expect(mockTrack).not.toHaveBeenCalledWith('rage_tap', expect.anything(), expect.anything());
  });

  it('does NOT fire when taps are far apart (different buttons, not a dead one)', () => {
    recordGlobalTap(10, 10);
    recordGlobalTap(300, 300);
    recordGlobalTap(600, 600);
    expect(mockTrack).not.toHaveBeenCalledWith('rage_tap', expect.anything(), expect.anything());
  });

  it('does NOT fire when taps are spread beyond the 1s window', () => {
    recordGlobalTap(100, 100);
    jest.advanceTimersByTime(1200);
    recordGlobalTap(101, 101);
    jest.advanceTimersByTime(1200);
    recordGlobalTap(102, 102);
    expect(mockTrack).not.toHaveBeenCalledWith('rage_tap', expect.anything(), expect.anything());
  });

  it('cools down after firing — does not re-fire immediately on tap 4', () => {
    recordGlobalTap(100, 100);
    recordGlobalTap(101, 101);
    recordGlobalTap(102, 102); // fires here
    mockTrack.mockClear();
    recordGlobalTap(103, 103); // within cooldown
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it('re-arms after the cooldown window passes', () => {
    recordGlobalTap(100, 100);
    recordGlobalTap(101, 101);
    recordGlobalTap(102, 102); // fires
    mockTrack.mockClear();
    jest.advanceTimersByTime(2500); // past RAGE_TAP_COOLDOWN_MS (2000)
    recordGlobalTap(200, 200);
    recordGlobalTap(201, 201);
    recordGlobalTap(202, 202);
    expect(mockTrack).toHaveBeenCalledWith('rage_tap', expect.objectContaining({ tapCount: 3 }), 'screen-a');
  });
});

describe('frictionSignals — screen_abandon', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(2_000_000);
    onScreenChanged('initial'); // reset module-level screen state to this test's clock
    mockTrack.mockClear();
  });
  afterEach(() => { jest.useRealTimers(); });

  it('fires when leaving a screen within 3s with no interaction', () => {
    // beforeEach already entered 'initial' at the current fake-clock time — that's the
    // screen under test here, so just advance time and switch away from it.
    jest.advanceTimersByTime(1500);
    onScreenChanged('lobby');
    expect(mockTrack).toHaveBeenCalledWith('screen_abandon', expect.objectContaining({ dwellMs: 1500 }), 'initial');
  });

  it('does NOT fire if the user interacted before leaving', () => {
    recordGlobalTap(50, 50);
    jest.advanceTimersByTime(1500);
    onScreenChanged('lobby');
    expect(mockTrack).not.toHaveBeenCalledWith('screen_abandon', expect.anything(), expect.anything());
  });

  it('does NOT fire if the user stayed past the 3s window before leaving', () => {
    jest.advanceTimersByTime(3500);
    onScreenChanged('lobby');
    expect(mockTrack).not.toHaveBeenCalledWith('screen_abandon', expect.anything(), expect.anything());
  });
});

describe('frictionSignals — stuck_dwell', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(3_000_000);
    onScreenChanged('game'); // reset module-level screen state to this test's clock
    mockTrack.mockClear();
  });
  afterEach(() => { jest.useRealTimers(); });

  it('fires after 30s with zero interaction on the same screen', () => {
    jest.advanceTimersByTime(30_000);
    expect(mockTrack).toHaveBeenCalledWith('stuck_dwell', expect.objectContaining({ dwellMs: 30_000 }), 'game');
  });

  it('does NOT fire if the user interacted within the 30s window', () => {
    jest.advanceTimersByTime(15_000);
    recordGlobalTap(10, 10);
    jest.advanceTimersByTime(15_000);
    expect(mockTrack).not.toHaveBeenCalledWith('stuck_dwell', expect.anything(), expect.anything());
  });

  it('does NOT fire if the user navigated away before 30s', () => {
    jest.advanceTimersByTime(10_000);
    onScreenChanged('results');
    jest.advanceTimersByTime(30_000);
    expect(mockTrack).not.toHaveBeenCalledWith('stuck_dwell', expect.objectContaining({}), 'game');
  });
});
