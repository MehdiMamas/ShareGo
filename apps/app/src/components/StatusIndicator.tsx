import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SessionState, en } from "../lib/core";
import { colors } from "../styles/theme";

interface StatusIndicatorProps {
  state: SessionState;
}

const stateColors: Record<string, string> = {
  Created: colors.textSecondary,
  WaitingForSender: colors.primary,
  Handshaking: colors.primary,
  PendingApproval: colors.primary,
  Active: colors.success,
  Rejected: colors.error,
  Closed: colors.textSecondary,
};

const stateLabels: Record<string, string> = {
  [SessionState.Created]: en.status.created,
  [SessionState.WaitingForSender]: en.status.waitingForSender,
  [SessionState.Handshaking]: en.status.handshaking,
  [SessionState.PendingApproval]: en.status.pendingApproval,
  [SessionState.Active]: en.status.active,
  [SessionState.Rejected]: en.status.rejected,
  [SessionState.Closed]: en.status.closed,
};

export function StatusIndicator({ state }: StatusIndicatorProps) {
  const label = stateLabels[state] ?? state;
  const color = stateColors[state] ?? colors.textSecondary;

  return (
    <View style={styles.container}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>{label}</Text>
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
