import { generateInternetRoomCode, isOnlineMultiplayerAvailable } from '../internetMultiplayer';

describe('Internet Multiplayer', () => {
  describe('generateInternetRoomCode', () => {
    it('generates 6-char code', () => {
      const code = generateInternetRoomCode();
      expect(code).toHaveLength(6);
    });

    it('code is numeric', () => {
      for (let i = 0; i < 50; i++) {
        expect(/^\d{6}$/.test(generateInternetRoomCode())).toBe(true);
      }
    });

    it('code does not start with 0', () => {
      for (let i = 0; i < 50; i++) {
        expect(generateInternetRoomCode()[0]).not.toBe('0');
      }
    });

    it('generates unique codes (50 samples)', () => {
      const codes = new Set(Array.from({ length: 50 }, generateInternetRoomCode));
      expect(codes.size).toBeGreaterThan(45);
    });
  });

  describe('isOnlineMultiplayerAvailable', () => {
    it('returns a boolean', () => {
      expect(typeof isOnlineMultiplayerAvailable()).toBe('boolean');
    });
  });
});
