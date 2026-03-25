/**
 * @caps/debugger — DebugOverlay component
 * Floating 🐛 button + scrollable log overlay.
 * Self-contained — uses shared log state from debugLog.ts.
 */
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import {
  getGlobalLogs,
  setGlobalListener,
  getIsRecording,
  getRecordingStart,
  type LogEntry,
} from '../src/debugLog';

interface DebugOverlayProps {
  visible?: boolean;
}

export function DebugOverlay({ visible = true }: DebugOverlayProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [minimized, setMinimized] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setGlobalListener(setLogs);
    setLogs(getGlobalLogs());
    return () => setGlobalListener(null);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: false });
  }, [logs]);

  useEffect(() => {
    const iv = setInterval(() => {
      if (getIsRecording()) setRecSecs(Math.floor((Date.now() - getRecordingStart()) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  if (!visible) return null;

  if (minimized) {
    return (
      <TouchableOpacity style={styles.bubble} onPress={() => setMinimized(false)}>
        <Text style={styles.bubbleText}>🐛 {logs.length}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.overlay}>
        <View style={styles.header}>
          <Text style={styles.headerText}>🐛 DEBUG ({logs.length})</Text>
          {getIsRecording() && (
            <Text style={styles.recText}>🎥 REC ● {recSecs}s</Text>
          )}
          <TouchableOpacity onPress={() => setMinimized(true)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.minimizeBtn}>▼</Text>
          </TouchableOpacity>
        </View>
        <ScrollView ref={scrollRef} style={styles.logArea} scrollEnabled showsVerticalScrollIndicator={false}>
          {logs.map((log, i) => (
            <Text
              key={i}
              style={[
                styles.logLine,
                log.level === 'error' && styles.errorLine,
                log.level === 'warn' && styles.warnLine,
              ]}
              numberOfLines={2}
            >
              <Text style={styles.logTime}>{log.time} </Text>{log.message}
            </Text>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: 8,
    right: 8,
    zIndex: 99999,
  },
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.88)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,255,0,0.35)',
    maxHeight: 200,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,255,0,0.2)',
  },
  headerText: {
    color: '#00ff00',
    fontSize: 11,
    fontWeight: '700',
  },
  minimizeBtn: {
    color: '#00ff00',
    fontSize: 14,
    paddingHorizontal: 8,
  },
  recText: {
    color: '#ff4444',
    fontSize: 9,
    fontWeight: '700',
    marginRight: 4,
  },
  logArea: {
    maxHeight: 160,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  logLine: {
    color: '#00ff00',
    fontSize: 9,
    lineHeight: 13,
    marginBottom: 1,
  },
  errorLine: { color: '#ff4444' },
  warnLine: { color: '#ffaa00' },
  logTime: {
    color: '#666666',
    fontSize: 8,
  },
  bubble: {
    position: 'absolute',
    bottom: 100,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.88)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,255,0,0.35)',
    zIndex: 99999,
  },
  bubbleText: {
    color: '#00ff00',
    fontSize: 11,
  },
});
