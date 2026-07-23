import React from 'react';
import { View, Platform } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { FRIENDS_BGS, FriendsBgId } from '../constants/friendsBgs';
import { themeAxes } from '../constants/visualThemes';

export function FriendsBg() {
  // BATCH-B: background is now DERIVED from Visual Style (folded), not an independent picker.
  const visualTheme = useGameStore((s) => s.visualTheme);
  const friendsBg = themeAxes(visualTheme).bg;
  if (friendsBg === 'none') return null;

  const bg = FRIENDS_BGS[friendsBg as Exclude<FriendsBgId, 'none'>];
  if (!bg) return null;

  if (Platform.OS === 'web') {
    return (
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 0,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          src={`data:image/svg+xml;utf8,${encodeURIComponent(bg.svg(bg.color))}`}
          style={{
            width: bg.width,
            height: bg.height,
            opacity: bg.opacity,
            position: 'absolute',
            ...bg.position,
          } as React.CSSProperties}
        />
      </View>
    );
  }

  // Native: skip (react-native-svg not installed)
  return null;
}
