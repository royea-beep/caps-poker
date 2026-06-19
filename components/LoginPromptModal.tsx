import React, { useEffect } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { loginWithGoogle, dismissLoginPrompt } from '../utils/auth';
import { track } from '../utils/analytics';

interface Props {
  visible: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

export default function LoginPromptModal({ visible, onClose, onLoginSuccess }: Props) {
  useEffect(() => {
    if (visible) track('google_prompt_shown', {}, 'login_prompt');
  }, [visible]);

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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleDismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Save your progress</Text>
          <Text style={styles.subtitle}>
            Sign in with Google to keep your chips, streak, and cups forever
          </Text>

          <Pressable style={styles.googleBtn} onPress={handleGoogle}>
            <Text style={styles.googleText}>Sign in with Google</Text>
          </Pressable>

          <Pressable style={styles.laterBtn} onPress={handleDismiss}>
            <Text style={styles.laterText}>Maybe later</Text>
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
    color: '#4FD6A8',
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
