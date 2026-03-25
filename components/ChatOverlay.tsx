/**
 * ChatOverlay — floating chat + emote bar for internet multiplayer.
 * ZERO Reanimated — RN Animated only.
 * S60 sprint.
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

interface Props {
  myName: string;
  onSend: (text: string) => void; // called when player sends a message or emote
  messages: ChatMessage[];        // externally managed list (max 3 shown)
}

const EMOTES = ['😂', '💀', '🔥', '👏', '😤', '🤝'];
const AUTO_DISMISS_MS = 4000;

export default function ChatOverlay({ myName, onSend, messages }: Props) {
  const [inputText, setInputText] = useState('');
  const [showInput, setShowInput] = useState(false);

  const handleEmote = useCallback((emote: string) => {
    onSend(emote);
  }, [onSend]);

  const handleSend = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInputText('');
    setShowInput(false);
    Keyboard.dismiss();
  }, [inputText, onSend]);

  // Show max 3 messages
  const visible = messages.slice(-3);

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Message bubbles — max 3, newest at bottom */}
      <View style={styles.messagesArea} pointerEvents="none">
        {visible.map((msg) => (
          <FadingBubble key={msg.id} msg={msg} />
        ))}
      </View>

      {/* Input row (when expanded) */}
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
          />
          <Pressable style={styles.sendBtn} onPress={handleSend}>
            <Text style={styles.sendBtnText}>SEND</Text>
          </Pressable>
        </View>
      )}

      {/* Emote + chat toggle bar */}
      <View style={styles.emoteBar}>
        {EMOTES.map((emote) => (
          <Pressable key={emote} style={styles.emoteBtn} onPress={() => handleEmote(emote)}>
            <Text style={styles.emoteText}>{emote}</Text>
          </Pressable>
        ))}
        <Pressable
          style={[styles.emoteBtn, styles.chatToggleBtn]}
          onPress={() => setShowInput((v) => !v)}
        >
          <Text style={styles.chatToggleText}>{showInput ? '✕' : '💬'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Single message bubble that fades out after AUTO_DISMISS_MS */
function FadingBubble({ msg }: { msg: ChatMessage }) {
  const opacity = useRef(new AnimatedRN.Value(1)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      AnimatedRN.timing(opacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start();
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
  container: {
    position: 'absolute',
    bottom: rs(80),
    left: 0,
    right: 0,
    paddingHorizontal: rs(12),
    gap: rs(4),
  },
  messagesArea: {
    gap: rs(4),
    marginBottom: rs(4),
  },
  bubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.65)',
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
  bubbleMe: {
    alignSelf: 'flex-end',
    borderColor: 'rgba(201,168,76,0.3)',
    backgroundColor: 'rgba(201,168,76,0.12)',
  },
  bubbleSender: {
    color: COLORS.goldBright,
    fontSize: rf(10),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  bubbleText: {
    color: COLORS.textPrimary,
    fontSize: rf(13),
    fontWeight: '500',
    flexShrink: 1,
  },
  emoteBar: {
    flexDirection: 'row',
    gap: rs(4),
    alignItems: 'center',
  },
  emoteBtn: {
    width: rs(36),
    height: rs(36),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: rv(8),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    ...Platform.select({ web: { cursor: 'pointer' } as any }),
  },
  emoteText: {
    fontSize: rf(18),
  },
  chatToggleBtn: {
    borderColor: 'rgba(201,168,76,0.4)',
    backgroundColor: 'rgba(201,168,76,0.1)',
    marginLeft: rs(4),
  },
  chatToggleText: {
    fontSize: rf(16),
  },
  inputRow: {
    flexDirection: 'row',
    gap: rs(6),
    alignItems: 'center',
  },
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
  sendBtn: {
    backgroundColor: COLORS.gold,
    borderRadius: rv(8),
    paddingHorizontal: rs(14),
    paddingVertical: rs(9),
    justifyContent: 'center',
  },
  sendBtnText: {
    color: COLORS.background,
    fontSize: rf(12),
    fontWeight: '800',
    letterSpacing: 1,
  },
});
