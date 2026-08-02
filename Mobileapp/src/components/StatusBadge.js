import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../utils/theme';

const STATUS_MAP = {
  open: { label: 'Open', bg: COLORS.redDim, text: COLORS.redText, border: COLORS.redBorder },
  resolved: { label: 'Resolved', bg: COLORS.emeraldDim, text: COLORS.emeraldText, border: COLORS.emeraldBorder },
  ignored: { label: 'Ignored', bg: 'rgba(100,116,139,0.15)', text: COLORS.textSecondary, border: 'rgba(100,116,139,0.30)' },
};

const LEVEL_MAP = {
  error: { label: 'Error', bg: COLORS.redDim, text: COLORS.redText, border: COLORS.redBorder },
  warning: { label: 'Warning', bg: COLORS.amberDim, text: COLORS.amberText, border: COLORS.amberBorder },
  info: { label: 'Info', bg: COLORS.blueDim, text: COLORS.blueText, border: COLORS.blueBorder },
};

export default function StatusBadge({ status, level }) {
  const map = status ? STATUS_MAP[status] : level ? LEVEL_MAP[level] : null;
  if (!map) return null;

  return (
    <View style={[styles.badge, { backgroundColor: map.bg, borderColor: map.border }]}>
      <Text style={[styles.label, { color: map.text }]}>{map.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 9999,
    borderWidth: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
});
