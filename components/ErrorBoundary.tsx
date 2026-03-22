import React, { Component } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { rv, rf, rs, rb } from '../utils/responsive';

interface Props {
  children: React.ReactNode;
  onError?: (error: Error) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] caught:', error.message);
    console.error('[ErrorBoundary] stack:', error.stack?.slice(0, 500));
    this.props.onError?.(error);
    // Log to Supabase bug_reports silently
    try {
      const { getSupabase } = require('../utils/supabase');
      const sb = getSupabase();
      if (sb) {
        sb.from('bug_reports').insert({
          description: `[AUTO-CRASH] ${error.message.slice(0, 300)}`,
          stack_trace: `${error.stack?.slice(0, 1500)}\n\n---component stack---\n${info.componentStack?.slice(0, 500)}`,
          platform: Platform.OS,
          app_version: '1.9.4',
          severity: 'CRITICAL',
        }).then(() => {}).catch(() => {});
      }
    } catch {}
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    try {
      router.replace('/');
    } catch {}
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>💥</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>
            The error was reported automatically.{'\n'}Tap below to restart.
          </Text>
          {this.state.error && (
            <Text style={styles.errorText} numberOfLines={3}>
              {this.state.error.message}
            </Text>
          )}
          <Pressable style={styles.button} onPress={this.handleReset}>
            <Text style={styles.buttonText}>TAP TO RESTART</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0E18',
    alignItems: 'center',
    justifyContent: 'center',
    padding: rs(32),
    gap: rs(16),
  },
  emoji: {
    fontSize: rf(56),
  },
  title: {
    color: '#fff',
    fontSize: rf(22),
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 1,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: rf(14),
    textAlign: 'center',
    lineHeight: rf(20),
  },
  errorText: {
    color: 'rgba(255,80,80,0.7)',
    fontSize: rf(11),
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    maxWidth: rv(320),
  },
  button: {
    marginTop: rs(8),
    backgroundColor: '#c8a84b',
    paddingHorizontal: rs(32),
    paddingVertical: rs(14),
    borderRadius: rv(8),
  },
  buttonText: {
    color: '#000',
    fontSize: rf(14),
    fontWeight: '900',
    letterSpacing: 2,
  },
});
