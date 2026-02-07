import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SessionState } from "../lib/core";
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
  [SessionState.Created]: "created",
  [SessionState.WaitingForSender]: "waiting for sender",
  [SessionState.Handshaking]: "handshaking",
  [SessionState.PendingApproval]: "pending approval",
  [SessionState.Active]: "active",
  [SessionState.Rejected]: "rejected",
  [SessionState.Closed]: "closed",
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
