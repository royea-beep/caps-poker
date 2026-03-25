/**
 * ShareSection — game-wide share buttons + offscreen FullGameShareCard.
 * ZERO Reanimated. Renders null on web (no native share API).
 */
import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, Pressable, ActionSheetIOS, Alert } from 'react-native';
import { FullGameShareCard, StoryShareCard } from './ShareCard';
import { captureAndShare, saveHandForWebReplay, generateShareText, copyToClipboard, ShareData } from '../utils/shareHand';
import { rf, rs, rv } from '../utils/responsive';

interface ShareSectionProps {
  shareData: ShareData;
  autoShareUrl: string | null;
  boards: any[];
  netChips: number;
  isComplete: boolean;
  completeBonusAmount: number;
  potPerBoard: number;
  numberOfPlayers: number;
}

export function ShareSection({
  shareData, autoShareUrl, boards, netChips, isComplete,
  completeBonusAmount, potPerBoard, numberOfPlayers,
}: ShareSectionProps) {
  const gameShareRef = useRef<any>(null);
  const gameStoryRef = useRef<any>(null);
  const [sharingGame, setSharingGame] = useState(false);

  if (Platform.OS === 'web') return null;

  const doShareGame = async (ref: React.RefObject<any>) => {
    setSharingGame(true);
    await new Promise((r) => setTimeout(r, 150));
    const url = autoShareUrl ?? await saveHandForWebReplay(shareData).catch(() => null);
    const text = generateShareText(shareData, url);
    await captureAndShare(ref, text);
    setSharingGame(false);
  };

  const doCopy = async () => {
    const url = autoShareUrl ?? await saveHandForWebReplay(shareData).catch(() => null);
    if (url) { await copyToClipboard(url); Alert.alert('Link copied!', url); }
  };

  const handleShare = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Share Image', 'Share as Story', 'Copy Replay Link'], cancelButtonIndex: 0 },
        (i) => {
          if (i === 1) doShareGame(gameShareRef);
          else if (i === 2) doShareGame(gameStoryRef);
          else if (i === 3) doCopy();
        }
      );
    } else {
      Alert.alert('Share Game', undefined, [
        { text: 'Share Image', onPress: () => doShareGame(gameShareRef) },
        { text: 'Share as Story', onPress: () => doShareGame(gameStoryRef) },
        { text: 'Copy Replay Link', onPress: doCopy },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  return (
    <View style={{ width: '100%', gap: 8 }}>
      <View style={styles.shareGameRow}>
        <Pressable
          onPress={handleShare}
          style={[styles.shareGameBtn, sharingGame && styles.shareBtnLoading]}
          disabled={sharingGame}
        >
          <Text style={styles.shareGameBtnText}>{sharingGame ? 'Generating...' : '📸 Share Game'}</Text>
        </Pressable>
        <Pressable onPress={doCopy} style={styles.copyLinkBtn}>
          <Text style={styles.copyLinkText}>📋 Copy Replay Link</Text>
        </Pressable>
      </View>
      <View ref={gameShareRef as any} style={styles.offscreen} pointerEvents="none">
        <FullGameShareCard boards={boards as any} netChips={netChips} isComplete={isComplete} completeBonusAmount={completeBonusAmount} potPerBoard={potPerBoard} numberOfPlayers={numberOfPlayers} />
      </View>
      <View ref={gameStoryRef as any} style={styles.offscreen} pointerEvents="none">
        <StoryShareCard boards={boards as any} netChips={netChips} isComplete={isComplete} completeBonusAmount={completeBonusAmount} potPerBoard={potPerBoard} numberOfPlayers={numberOfPlayers} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shareGameRow: { flexDirection: 'row', gap: rs(8), width: '100%' },
  shareGameBtn: { flex: 1, backgroundColor: 'rgba(255,215,0,0.12)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.35)', borderRadius: rv(10), paddingVertical: rs(10), alignItems: 'center' },
  shareBtnLoading: { opacity: 0.5 },
  shareGameBtnText: { color: '#FFD700', fontSize: rf(14), fontWeight: '700' },
  copyLinkBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: rv(10), paddingVertical: rs(10), alignItems: 'center' },
  copyLinkText: { color: 'rgba(255,255,255,0.6)', fontSize: rf(14), fontWeight: '600' },
  offscreen: { position: 'absolute', left: -9999, top: 0, opacity: 0, zIndex: -1 },
});
