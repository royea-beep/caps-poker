import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform, TouchableOpacity } from 'react-native';

const MAX_LOGS = 50;

interface LogEntry {
  time: string;
  message: string;
  level: 'info' | 'warn' | 'error';
}

// Global — accessible from any file without React context
let globalLogs: LogEntry[] = [];
let globalListener: ((logs: LogEntry[]) => void) | null = null;

// Recording state — set by screenRecorder to avoid circular import
let _isRecording = false;
let _recordingStart = 0;
export function setDebugRecording(recording: boolean) {
  _isRecording = recording;
  _recordingStart = recording ? Date.now() : _recordingStart;
  if (globalListener) globalListener([...globalLogs]); // force re-render
}

export function getGlobalLogs(): LogEntry[] { return [...globalLogs]; }

export function debugLog(message: string, level: 'info' | 'warn' | 'error' = 'info') {
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
  const entry: LogEntry = { time, message, level };
  globalLogs = [...globalLogs.slice(-(MAX_LOGS - 1)), entry];
  if (globalListener) globalListener([...globalLogs]);
  console.log(`[DBG ${time}] ${message}`);
}

export default function DebugOverlay() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [minimized, setMinimized] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    globalListener = setLogs;
    setLogs([...globalLogs]);
    return () => { globalListener = null; };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: false });
  }, [logs]);

  // Update recording duration every second
  useEffect(() => {
    const iv = setInterval(() => {
      if (_isRecording) setRecSecs(Math.floor((Date.now() - _recordingStart) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, []);

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
          {_isRecording && (
            <Text style={styles.recText}>🎥 REC ● {recSecs}s</Text>
          )}
          <TouchableOpacity onPress={() => setMinimized(true)} hitSlop={12}>
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
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 0, 0.35)',
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
    borderBottomColor: 'rgba(0, 255, 0, 0.2)',
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
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 0, 0.35)',
    zIndex: 99999,
  },
  bubbleText: {
    color: '#00ff00',
    fontSize: 11,
  },
});
