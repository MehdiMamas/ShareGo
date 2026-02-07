import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
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

export function StatusIndicator({ state }: StatusIndicatorProps) {
  const { t } = useTranslation();
  
  const label = {
    [SessionState.Created]: t("status.created"),
    [SessionState.WaitingForSender]: t("status.waitingForSender"),
    [SessionState.Handshaking]: t("status.handshaking"),
    [SessionState.PendingApproval]: t("status.pendingApproval"),
    [SessionState.Active]: t("status.active"),
    [SessionState.Rejected]: t("status.rejected"),
    [SessionState.Closed]: t("status.closed"),
  }[state] ?? state;
  
  const color = stateColors[state] ?? colors.textSecondary;
  const info = { label, color };

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
