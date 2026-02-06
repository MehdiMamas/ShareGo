import React from "react";
import { View, Text, StyleSheet } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { colors } from "../styles/theme";

interface QRDisplayProps {
  value: string;
  sessionId: string;
}

export function QRDisplay({ value, sessionId }: QRDisplayProps) {
  return (
    <View style={styles.container}>
      <View style={styles.qrWrapper}>
        <QRCode
          value={value}
          size={200}
          backgroundColor="#ffffff"
          color="#000000"
        />
      </View>

      <View style={styles.codeSection}>
        <Text style={styles.codeLabel}>manual code</Text>
        <Text style={styles.codeValue}>{sessionId}</Text>
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
    backgroundColor: "#ffffff",
  },
  codeSection: {
    alignItems: "center",
    gap: 4,
  },
  codeLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  codeValue: {
    fontSize: 24,
    fontWeight: "700",
    fontFamily: "monospace",
    color: colors.textPrimary,
    letterSpacing: 4,
  },
});
