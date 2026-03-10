export type GamePhase =
  | { type: 'idle' }
  | { type: 'arranging'; timeLeft: number }
  | { type: 'waiting_for_bot' }
  | { type: 'revealing'; boardIndex: number }
  | { type: 'complete'; winnerId: 'player' | 'bot' | null }
  | { type: 'summary' };
