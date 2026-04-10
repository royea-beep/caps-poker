/**
 * Generate a 4-digit numeric room code (1000-9999).
 */
export function generateRoomCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export function formatRoomCode(code: string): string {
  return code.toUpperCase();
}
