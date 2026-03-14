/**
 * Generate a 6-digit numeric room code (100000-999999).
 */
export function generateRoomCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
