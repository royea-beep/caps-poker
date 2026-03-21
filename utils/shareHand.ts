/**
 * shareHand.ts — capture ShareCard as image and open iOS/Android share sheet.
 * Also saves hand data to Supabase for web replay.
 */
import { Platform } from 'react-native';
import { RevealBoardData, RevealData } from '../types/gameTypes';
import { getSupabase, isSupabaseConfigured } from './supabase';

// Lazy-load native-only modules to avoid web crashes
let captureRef: ((ref: any, options?: any) => Promise<string>) | null = null;
let Sharing: any = null;

try {
  captureRef = require('react-native-view-shot').captureRef;
} catch {}

try {
  Sharing = require('expo-sharing');
} catch {}

export interface ShareData {
  boards: RevealBoardData[];
  netChips: number;
  isComplete: boolean;
  completeBonusAmount: number;
  boardsWon: number;
  totalBoards: number;
  potPerBoard: number;
  numberOfPlayers: number;
}

// Generate a short alphanumeric ID (8 chars)
function generateShortId(): string {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

// Capture a ViewShot ref and open the share sheet
export async function captureAndShare(viewRef: React.RefObject<any>, shareText: string): Promise<void> {
  if (Platform.OS === 'web') {
    // Web: copy text to clipboard instead
    try {
      await navigator.clipboard.writeText(shareText);
    } catch {}
    return;
  }

  if (!captureRef || !Sharing) return;

  try {
    const uri = await captureRef(viewRef, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share CAPS Hand',
        UTI: 'public.png',
      });
    }
  } catch (e) {
    console.warn('[shareHand] capture/share failed:', e);
  }
}

// Save hand data to Supabase shared_hands table, returns web replay URL
export async function saveHandForWebReplay(data: ShareData): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const handId = generateShortId();

  try {
    const { error } = await supabase.from('shared_hands').insert({
      id: handId,
      data: data,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (error) {
      console.warn('[shareHand] Supabase insert failed:', error.message);
      return null;
    }
    return `https://caps.ftable.co.il/hand/?id=${handId}`;
  } catch (e) {
    console.warn('[shareHand] saveHandForWebReplay failed:', e);
    return null;
  }
}

// Generate share text for the native share sheet
export function generateShareText(data: ShareData, replayUrl?: string | null): string {
  const emoji = data.isComplete ? '🏆' : data.netChips > 0 ? '✅' : '❌';
  const completeLine = data.isComplete ? '\n🏆 COMPLETE! Swept all boards!' : '';
  const urlLine = replayUrl ? `\nReplay: ${replayUrl}` : '';

  return `${emoji} CAPS Poker — ${data.boardsWon}/${data.totalBoards} boards won!${completeLine}
Net: ${data.netChips >= 0 ? '+' : ''}${data.netChips} chips${urlLine}

Play CAPS: caps.ftable.co.il`;
}

// Copy text to clipboard (cross-platform)
export async function copyToClipboard(text: string): Promise<void> {
  if (Platform.OS === 'web') {
    try { await navigator.clipboard.writeText(text); } catch {}
    return;
  }
  try {
    const Clipboard = require('@react-native-clipboard/clipboard').default;
    Clipboard.setString(text);
  } catch {
    // Clipboard not available — silent fail
  }
}
