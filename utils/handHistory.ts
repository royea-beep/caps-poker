import AsyncStorage from '@react-native-async-storage/async-storage';

export interface HandPlayerRecord {
  name: string;
  handName: string;
  cards: { rank: string; suit: string }[];
  isWinner: boolean;
}

export interface HandBoardRecord {
  boardIndex: number;
  winner: 'player' | 'bot' | 'tie';
  playerHandName: string;
  botHandName: string;
  playerCards: { rank: string; suit: string }[];
  botCards: { rank: string; suit: string }[];
  communityCards: { rank: string; suit: string }[];
}

export interface HandRecord {
  id: string;
  timestamp: number;
  boards: HandBoardRecord[];
  netChips: number;
  potPerBoard: number;
  numberOfPlayers: number;
  boardCount: number;
  isComplete: boolean;
  completeBonusAmount: number;
}

const HISTORY_KEY = 'caps_hand_history';
const MAX_RECORDS = 10;

export async function saveHandToHistory(hand: HandRecord): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    const history: HandRecord[] = raw ? JSON.parse(raw) : [];
    history.unshift(hand);
    if (history.length > MAX_RECORDS) history.pop();
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Silent fail — history is non-critical
  }
}

export async function getHandHistory(): Promise<HandRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function clearHandHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(HISTORY_KEY);
  } catch {
    // Silent fail
  }
}
