/**
 * AvatarPicker — modal for choosing an emoji avatar + display name.
 * ZERO Reanimated — iron rule.
 */
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { COLORS } from '../constants/gameConfig';
import { rf, rs, rv } from '../utils/responsive';
import { avatarOptionsFor, AVATAR_OPTIONS } from '../utils/playerProfile';
import { useOwnedSkus } from '../utils/ownedItems';

interface Props {
  visible: boolean;
  currentAvatar: string;
  currentName: string;
  onSave: (avatar: string, name: string) => void;
  onClose: () => void;
}

export default function AvatarPicker({ visible, currentAvatar, currentName, onSave, onClose }: Props) {
  const [selectedAvatar, setSelectedAvatar] = useState(currentAvatar);
  const [nameText, setNameText] = useState(currentName);
  // THREE-FAMILIES — the grid grows when buy_avatar is owned; it is never smaller than today's.
  const { skus, ready } = useOwnedSkus();
  const options = avatarOptionsFor(skus);

  // A selection must not outlive its entitlement. Only act once ownership has actually loaded —
  // resetting on a set that simply has not arrived would clear an avatar the player does own.
  useEffect(() => {
    if (!ready) return;
    if (!options.includes(selectedAvatar) && AVATAR_OPTIONS.length > 0) setSelectedAvatar(AVATAR_OPTIONS[0]);
  }, [ready, options, selectedAvatar]);

  const handleSave = () => {
    onSave(selectedAvatar, nameText.trim().slice(0, 20) || currentName);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>YOUR PROFILE</Text>

          {/* Preview */}
          <View style={styles.preview}>
            <Text style={styles.previewAvatar}>{selectedAvatar}</Text>
            <Text style={styles.previewName} numberOfLines={1}>
              {nameText || 'Player 1'}
            </Text>
          </View>

          {/* Avatar grid */}
          <Text style={styles.sectionLabel}>CHOOSE AVATAR</Text>
          <View style={styles.grid}>
            {options.map((emoji) => (
              <Pressable
                key={emoji}
                style={[styles.avatarBtn, selectedAvatar === emoji && styles.avatarBtnSelected]}
                onPress={() => setSelectedAvatar(emoji)}
                testID={`avatar-${emoji}`}
                accessibilityRole="radio"
                accessibilityLabel={`Avatar ${emoji}`}
                accessibilityState={{ checked: selectedAvatar === emoji }}
              >
                <Text style={styles.avatarEmoji}>{emoji}</Text>
              </Pressable>
            ))}
          </View>

          {/* Name input */}
          <Text style={styles.sectionLabel}>DISPLAY NAME</Text>
          <TextInput
            style={styles.nameInput}
            value={nameText}
            onChangeText={(t) => setNameText(t.slice(0, 20))}
            placeholder="Player 1"
            placeholderTextColor={COLORS.textDim}
            maxLength={20}
            selectTextOnFocus
            returnKeyType="done"
            onSubmitEditing={handleSave}
            autoCorrect={false}
          />

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>CANCEL</Text>
            </Pressable>
            <Pressable style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>SAVE</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: rs(20),
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: rv(16),
    padding: rs(20),
    width: '100%',
    maxWidth: 380,
    gap: rs(14),
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.25)',
    ...Platform.select({ web: { cursor: 'default' } as any }),
  },
  title: {
    fontSize: rf(16),
    fontWeight: '900',
    color: COLORS.gold,
    letterSpacing: 4,
    textAlign: 'center',
  },
  preview: {
    alignItems: 'center',
    gap: rs(4),
    paddingVertical: rs(8),
    backgroundColor: COLORS.background,
    borderRadius: rv(10),
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
  },
  previewAvatar: {
    fontSize: rf(40),
  },
  previewName: {
    fontSize: rf(14),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  sectionLabel: {
    fontSize: rf(10),
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: rs(8),
    justifyContent: 'center',
  },
  avatarBtn: {
    width: rs(48),
    height: rs(48),
    borderRadius: rv(10),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: 'transparent',
    ...Platform.select({ web: { cursor: 'pointer' } as any }),
  },
  avatarBtnSelected: {
    borderColor: COLORS.gold,
    backgroundColor: 'rgba(201,168,76,0.12)',
  },
  avatarEmoji: {
    fontSize: rf(24),
  },
  nameInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.35)',
    borderRadius: rv(8),
    paddingHorizontal: rs(12),
    paddingVertical: rs(10),
    color: COLORS.textPrimary,
    fontSize: rf(15),
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: rs(10),
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: rs(12),
    borderRadius: rv(8),
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: rf(13),
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 1,
  },
  saveBtn: {
    flex: 1,
    paddingVertical: rs(12),
    borderRadius: rv(8),
    backgroundColor: COLORS.gold,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: rf(13),
    fontWeight: '900',
    color: COLORS.background,
    letterSpacing: 1,
  },
});
