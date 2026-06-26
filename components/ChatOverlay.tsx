/**
 * Chat + emote for internet multiplayer — VAMOS-CAPS-PLACEMENT-UI-FIX.
 *
 * Split into two non-overlapping pieces so neither covers the player's cards:
 *  - ChatBar (default): an IN-FLOW dedicated strip (emote row + optional text input).
 *    The parent docks it below the hand, so it never floats on top of cards (Issue A).
 *    Uses space-between so the 6 emotes + chat toggle lay out cleanly 320–480px (Issue D).
 *  - ChatBubbles: a floating TOP toast layer (pointerEvents none, auto-fading), away from
 *    the boards and the hand — bubbles no longer render over Board 4 / cards (Issue B).
 * ZERO Reanimated — RN Animated only.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Animated as AnimatedRN,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
  Keyboard,
} from 'react-native';
import { COLORS } from '../constants/gameConfig';
import { rs, rf, rv } from '../utils/responsive';

export interface ChatMessage {
  id: string;
  playerName: string;
  text: string;
  isMe: boolean;
  timestamp: number;
}

export type SendKind = 'emote' | 'chat';

export const EMOTES = ['😂', '💀', '🔥', '👏', '😤', '🤝'];
const AUTO_DISMISS_MS = 4000;

interface BarProps {
  myName: string;
  onSend: (text: string, kind: SendKind) => void;
}

/** In-flow emote strip + optional text input. Docked below the hand by the parent. */
export default function ChatBar({ myName, onSend }: BarProps) {
  const [inputText, setInputText] = useState('');
  const [showInput, setShowInput] = useState(false);

  const handleEmote = useCallback((emote: string) => { onSend(emote, 'emote'); }, [onSend]);

  const handleSend = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    onSend(trimmed, 'chat');
    setInputText('');
    setShowInput(false);
    Keyboard.dismiss();
  }, [inputText, onSend]);

  return (
    <View style={styles.barRoot}>
      {showInput && (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={(t) => setInputText(t.slice(0, 60))}
            placeholder="Type a message..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            returnKeyType="send"
            onSubmitEditing={handleSend}
            autoFocus
            maxLength={60}
            accessibilityLabel="Chat message input"
          />
          <Pressable style={styles.sendBtn} onPress={handleSend} accessibilityRole="button" accessibilityLabel="Send message">
            <Text style={styles.sendBtnText}>SEND</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.emoteBar}>
        {EMOTES.map((emote) => (
          <Pressable key={emote} style={styles.emoteBtn} onPress={() => handleEmote(emote)} accessibilityRole="button" accessibilityLabel={`Send ${emote} emote`}>
            <Text style={styles.emoteText}>{emote}</Text>
          </Pressable>
        ))}
        <Pressable
          style={[styles.emoteBtn, styles.chatToggleBtn]}
          onPress={() => setShowInput((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={showInput ? 'Close chat input' : 'Open chat input'}
        >
          <Text style={styles.chatToggleText}>{showInput ? '✕' : '💬'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Floating top toast layer for incoming/outgoing messages — never over the cards. */
export function ChatBubbles({ messages }: { messages: ChatMessage[] }) {
  const visible = messages.slice(-3);
  if (visible.length === 0) return null;
  return (
    <View style={styles.bubblesLayer} pointerEvents="none">
      {visible.map((msg) => (
        <FadingBubble key={msg.id} msg={msg} />
      ))}
    </View>
  );
}

/** Single message bubble that fades out after AUTO_DISMISS_MS */
function FadingBubble({ msg }: { msg: ChatMessage }) {
  const opacity = useRef(new AnimatedRN.Value(1)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      AnimatedRN.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }).start();
    }, AUTO_DISMISS_MS - 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatedRN.View style={[styles.bubble, msg.isMe && styles.bubbleMe, { opacity }]}>
      <Text style={styles.bubbleSender}>{msg.isMe ? 'You' : msg.playerName}</Text>
      <Text style={styles.bubbleText}>{msg.text}</Text>
    </AnimatedRN.View>
  );
}

const styles = StyleSheet.create({
  // In-flow dedicated strip — sits below the hand, never over cards.
  barRoot: {
    paddingHorizontal: rs(8),
    paddingTop: rv(4),
    paddingBottom: rv(2),
    gap: rv(4),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  emoteBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  emoteBtn: {
    width: rs(34),
    height: rs(34),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: rv(8),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    ...Platform.select({ web: { cursor: 'pointer' } as any }),
  },
  emoteText: { fontSize: rf(18) },
  chatToggleBtn: { borderColor: 'rgba(201,168,76,0.4)', backgroundColor: 'rgba(201,168,76,0.1)' },
  chatToggleText: { fontSize: rf(16) },
  inputRow: { flexDirection: 'row', gap: rs(6), alignItems: 'center' },
  textInput: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.4)',
    borderRadius: rv(8),
    paddingHorizontal: rs(12),
    paddingVertical: rs(8),
    color: COLORS.textPrimary,
    fontSize: rf(14),
  },
  sendBtn: { backgroundColor: COLORS.gold, borderRadius: rv(8), paddingHorizontal: rs(14), paddingVertical: rs(9), justifyContent: 'center' },
  sendBtnText: { color: COLORS.background, fontSize: rf(12), fontWeight: '800', letterSpacing: 1 },

  // Floating top toast layer — away from the boards + hand.
  bubblesLayer: {
    position: 'absolute',
    top: rv(44),
    left: 0,
    right: 0,
    paddingHorizontal: rs(12),
    gap: rs(4),
    alignItems: 'flex-start',
    zIndex: 50,
  },
  bubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.78)',
    borderRadius: rv(10),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: rs(10),
    paddingVertical: rs(5),
    maxWidth: '80%',
    flexDirection: 'row',
    gap: rs(6),
    alignItems: 'center',
  },
  bubbleMe: { alignSelf: 'flex-end', borderColor: 'rgba(201,168,76,0.3)', backgroundColor: 'rgba(201,168,76,0.18)' },
  bubbleSender: { color: COLORS.goldBright, fontSize: rf(10), fontWeight: '700', letterSpacing: 0.5 },
  bubbleText: { color: COLORS.textPrimary, fontSize: rf(13), fontWeight: '500', flexShrink: 1 },
});
