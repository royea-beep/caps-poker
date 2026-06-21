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
  resetKey: number;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, resetKey: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // VAMOS-HOOKS-CRASH-FIX 2026-06-21 — this boundary is the NEAREST ancestor of
    // the game tree (it wraps <GameScreenInner/> in app/game.tsx, BELOW expo-router's
    // internal Try), so for render-phase crashes like "Rendered fewer hooks than
    // expected" it catches FIRST with a populated info.componentStack. The previous
    // version dropped that stack and only fed the bug_reports pipeline, leaving
    // crash_reports.component_stack NULL. Route the stack to BOTH pipelines.
    const componentStack = info.componentStack ?? undefined;
    console.error('[ErrorBoundary] caught:', error.message);
    console.error('[ErrorBoundary] stack:', error.stack?.slice(0, 500));
    // TASK 3 self-check (temporary): confirm a real stack reached this boundary.
    console.log('[ErrorBoundary] componentStack length:', componentStack?.length ?? 0);
    this.props.onError?.(error);
    // Pipeline A (crash_reports.component_stack) — names the offending component chain.
    try {
      const { generateCrashReport } = require('../utils/crash-evidence');
      generateCrashReport({ message: error.message, stack: error.stack, componentStack }).catch(
        () => {},
      );
    } catch {}
    // Pipeline B (video stop + upload + WhatsApp alert) — forward the stack too.
    try {
      const { onCrashDetected } = require('../utils/crashDetector');
      onCrashDetected(error, componentStack);
    } catch {}
  }

  handleReset = () => {
    this.setState((prev) => ({ hasError: false, error: null, resetKey: prev.resetKey + 1 }));
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
    return (
      <React.Fragment key={this.state.resetKey}>
        {this.props.children}
      </React.Fragment>
    );
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
