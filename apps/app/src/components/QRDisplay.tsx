import React from "react";
import { View, Text, StyleSheet } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { en } from "../lib/core";
import { colors } from "../styles/theme";

interface QRDisplayProps {
  value: string;
  sessionId: string;
  address?: string;
}

export function QRDisplay({ value, sessionId, address }: QRDisplayProps) {
  return (
    <View style={styles.container}>
      <View style={styles.qrWrapper}>
        <QRCode
          value={value}
          size={200}
          backgroundColor={colors.white}
          color={colors.black}
        />
      </View>

      <Text style={styles.hint}>
        {en.qr.hint}
      </Text>

      <View style={styles.codeSection}>
        <View style={styles.codeRow}>
          <Text style={styles.codeLabel}>{en.qr.codeLabel}</Text>
          <Text style={styles.codeValue}>{sessionId}</Text>
        </View>

        {address && (
          <View style={styles.codeRow}>
            <Text style={styles.codeLabel}>{en.qr.addressLabel}</Text>
            <Text style={styles.addressValue}>{address}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 16,
  },
  qrWrapper: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.white,
  },
  hint: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
  },
  codeSection: {
    alignItems: "center",
    gap: 8,
    padding: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  codeLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  codeValue: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "monospace",
    color: colors.textPrimary,
    letterSpacing: 4,
  },
  addressValue: {
    fontSize: 14,
    fontFamily: "monospace",
    color: colors.textPrimary,
  },
});
