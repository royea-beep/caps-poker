import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import CardComponent from './Card';
import { Card, COLORS } from '../constants/gameConfig';

interface BoardProps {
  index: number;
  openCards: Card[];
  closedCards: Card[];
  playerCards: Card[];
  botCards: Card[];
  revealed: boolean;
  active: boolean;
  potAmount: number;
  winner?: 'player' | 'bot' | 'tie';
  playerHighlightIds?: string[];
  botHighlightIds?: string[];
  boardHighlightIds?: string[];
  playerHandName?: string;
  botHandName?: string;
  onPress?: () => void;
  isArrangement?: boolean;
}

export default function Board({
  index,
  openCards,
  closedCards,
  playerCards,
  botCards,
  revealed,
  active,
  potAmount,
  winner,
  playerHighlightIds = [],
  botHighlightIds = [],
  boardHighlightIds = [],
  playerHandName,
  botHandName,
  onPress,
  isArrangement,
}: BoardProps) {
  const allBoardCards = [...openCards, ...(revealed ? closedCards : [])];

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.container,
        active && styles.active,
        winner === 'player' && styles.playerWon,
        winner === 'bot' && styles.botWon,
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.boardLabel}>Board {index + 1}</Text>
        <Text style={styles.potLabel}>{potAmount} 🪙</Text>
      </View>

      {/* Bot cards */}
      <View style={styles.playerRow}>
        {botCards.length > 0 ? (
          botCards.map((c, i) => (
            <CardComponent
              key={c.id}
              card={c}
              faceDown={!revealed}
              small
              highlighted={revealed && botHighlightIds.includes(c.id)}
              dimmed={revealed && !botHighlightIds.includes(c.id) && botHighlightIds.length > 0}
            />
          ))
        ) : (
          Array.from({ length: 4 }).map((_, i) => (
            <View key={`bot-empty-${i}`} style={styles.emptySlot} />
          ))
        )}
      </View>
      {revealed && botHandName && (
        <Text style={[styles.handName, winner === 'bot' && styles.winnerHandName]}>{botHandName}</Text>
      )}

      {/* Community cards */}
      <View style={styles.communityRow}>
        {openCards.map((c) => (
          <CardComponent
            key={c.id}
            card={c}
            small
            highlighted={revealed && boardHighlightIds.includes(c.id)}
            dimmed={revealed && !boardHighlightIds.includes(c.id) && boardHighlightIds.length > 0}
          />
        ))}
        {revealed
          ? closedCards.map((c) => (
              <CardComponent
                key={c.id}
                card={c}
                small
                highlighted={boardHighlightIds.includes(c.id)}
                dimmed={!boardHighlightIds.includes(c.id) && boardHighlightIds.length > 0}
              />
            ))
          : closedCards.map((_, i) => (
              <CardComponent key={`closed-${i}`} faceDown small />
            ))}
      </View>

      {/* Player cards */}
      {revealed && playerHandName && (
        <Text style={[styles.handName, winner === 'player' && styles.winnerHandName]}>{playerHandName}</Text>
      )}
      <View style={styles.playerRow}>
        {playerCards.length > 0 ? (
          playerCards.map((c) => (
            <CardComponent
              key={c.id}
              card={c}
              small
              highlighted={revealed && playerHighlightIds.includes(c.id)}
              dimmed={revealed && !playerHighlightIds.includes(c.id) && playerHighlightIds.length > 0}
            />
          ))
        ) : (
          Array.from({ length: 4 }).map((_, i) => (
            <Pressable key={`player-empty-${i}`} style={[styles.emptySlot, isArrangement && styles.dropTarget]} onPress={onPress}>
              <Text style={styles.plusText}>+</Text>
            </Pressable>
          ))
        )}
        {playerCards.length > 0 && playerCards.length < 4 && isArrangement &&
          Array.from({ length: 4 - playerCards.length }).map((_, i) => (
            <Pressable key={`player-empty-fill-${i}`} style={[styles.emptySlot, styles.dropTarget]} onPress={onPress}>
              <Text style={styles.plusText}>+</Text>
            </Pressable>
          ))
        }
      </View>

      {winner && (
        <View style={[styles.winnerBadge, winner === 'player' ? styles.playerBadge : winner === 'bot' ? styles.botBadge : styles.tieBadge]}>
          <Text style={styles.winnerText}>
            {winner === 'player' ? 'YOU WIN' : winner === 'bot' ? 'BOT WINS' : 'TIE'}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.feltLight,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.boardBorder,
    padding: 4,
    width: '48%',
    marginBottom: 4,
  },
  active: {
    borderColor: COLORS.boardActive,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  playerWon: {
    borderColor: COLORS.success,
  },
  botWon: {
    borderColor: COLORS.danger,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  boardLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  potLabel: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: '700',
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 48,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  communityRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 2,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  emptySlot: {
    width: 32,
    height: 46,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
    borderStyle: 'dashed',
    margin: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropTarget: {
    borderColor: COLORS.gold,
    borderWidth: 1.5,
  },
  plusText: {
    color: COLORS.gold,
    fontSize: 16,
    opacity: 0.6,
  },
  handName: {
    color: COLORS.textSecondary,
    fontSize: 9,
    textAlign: 'center',
    fontWeight: '600',
  },
  winnerHandName: {
    color: COLORS.goldBright,
  },
  winnerBadge: {
    position: 'absolute',
    top: '45%',
    alignSelf: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  playerBadge: {
    backgroundColor: COLORS.success,
  },
  botBadge: {
    backgroundColor: COLORS.danger,
  },
  tieBadge: {
    backgroundColor: COLORS.goldDim,
  },
  winnerText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
