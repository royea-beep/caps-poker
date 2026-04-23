import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { loginWithGoogle, dismissLoginPrompt } from '../utils/auth';
import { track } from '../utils/analytics';

interface Props {
  visible: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

export default function LoginPromptModal({ visible, onClose, onLoginSuccess }: Props) {
  const handleGoogle = async () => {
    track('login_google_pressed', {}, 'login_prompt');
    const result = await loginWithGoogle();
    if (result.success) {
      track('login_google_success', {}, 'login_prompt');
      onLoginSuccess();
    } else {
      track('login_google_failed', { error: result.error }, 'login_prompt');
    }
  };

  const handleDismiss = async () => {
    track('login_dismissed', {}, 'login_prompt');
    await dismissLoginPrompt();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>שמור את ההתקדמות שלך</Text>
          <Text style={styles.subtitle}>
            התחבר עם Google כדי לשמור את הצ'יפים, הרצף והכוסות שלך לנצח
          </Text>

          <Pressable style={styles.googleBtn} onPress={handleGoogle}>
            <Text style={styles.googleText}>התחבר עם Google</Text>
          </Pressable>

          <Pressable style={styles.laterBtn} onPress={handleDismiss}>
            <Text style={styles.laterText}>אולי אחר כך</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10,5,5,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#1a1014',
    borderRadius: 16,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#c9a84c',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  googleBtn: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  googleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  laterBtn: {
    paddingVertical: 10,
  },
  laterText: {
    fontSize: 14,
    color: '#666',
  },
});
