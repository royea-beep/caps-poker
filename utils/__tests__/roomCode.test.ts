import { generateRoomCode, formatRoomCode } from '../roomCode';

describe('roomCode', () => {
  it('generates a 4-digit code', () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(4);
  });

  it('code is numeric', () => {
    const code = generateRoomCode();
    expect(/^\d{4}$/.test(code)).toBe(true);
  });

  it('code is >= 1000', () => {
    const code = generateRoomCode();
    expect(parseInt(code, 10)).toBeGreaterThanOrEqual(1000);
  });

  it('code is < 10000', () => {
    const code = generateRoomCode();
    expect(parseInt(code, 10)).toBeLessThan(10000);
  });

  it('generates unique codes (100 samples)', () => {
    const codes = new Set(Array.from({ length: 100 }, generateRoomCode));
    expect(codes.size).toBeGreaterThan(90);
  });

  it('formatRoomCode returns uppercase', () => {
    expect(formatRoomCode('1234')).toBe('1234');
    expect(formatRoomCode('abcd')).toBe('ABCD');
  });
});
