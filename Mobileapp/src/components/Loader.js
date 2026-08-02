import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { COLORS } from '../utils/theme';

export default function Loader({ fullPage = false, size = 'large' }) {
  if (fullPage) {
    return (
      <View style={styles.fullPage}>
        <ActivityIndicator size={size} color={COLORS.violet} />
        <Text style={styles.text}>Loading…</Text>
      </View>
    );
  }
  return (
    <View style={styles.inline}>
      <ActivityIndicator size={size} color={COLORS.violet} />
    </View>
  );
}

const styles = StyleSheet.create({
  fullPage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bg,
  },
  inline: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    marginTop: 12,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
});
