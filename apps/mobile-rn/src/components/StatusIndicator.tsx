import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SessionState } from "../lib/core";
import { colors } from "../styles/theme";

interface StatusIndicatorProps {
  state: SessionState;
}

const stateLabels: Record<string, { label: string; color: string }> = {
  Created: { label: "created", color: colors.textSecondary },
  WaitingForSender: { label: "waiting for sender...", color: colors.primary },
  Handshaking: { label: "handshaking...", color: colors.primary },
  PendingApproval: { label: "pending approval", color: colors.primary },
  Active: { label: "connected", color: colors.success },
  Rejected: { label: "rejected", color: colors.error },
  Closed: { label: "closed", color: colors.textSecondary },
};

export function StatusIndicator({ state }: StatusIndicatorProps) {
  const info = stateLabels[state] ?? {
    label: state,
    color: colors.textSecondary,
  };

  return (
    <View style={styles.container}>
      <View style={[styles.dot, { backgroundColor: info.color }]} />
      <Text style={[styles.label, { color: info.color }]}>{info.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
  },
});
