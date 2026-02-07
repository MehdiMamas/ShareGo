import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal } from "react-native";
import { useTranslation } from "react-i18next";
import type { PairingRequest } from "../lib/core";
import { colors } from "../styles/theme";

interface ApprovalDialogProps {
  request: PairingRequest;
  onApprove: () => void;
  onReject: () => void;
}

export function ApprovalDialog({
  request,
  onApprove,
  onReject,
}: ApprovalDialogProps) {
  const { t } = useTranslation();
  
  return (
    <Modal transparent animationType="fade" visible>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <Text style={styles.title}>{t("approval.title")}</Text>
          <Text style={styles.message}>
            {t("approval.body", { deviceName: request.deviceName })}
          </Text>

          <View style={styles.buttons}>
            <TouchableOpacity
              style={styles.rejectButton}
              onPress={onReject}
            >
              <Text style={styles.rejectButtonText}>{t("approval.reject")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={onApprove}
            >
              <Text style={styles.acceptButtonText}>{t("approval.accept")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 32,
    width: "90%",
    maxWidth: 360,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 21,
    marginBottom: 24,
  },
  deviceName: {
    fontWeight: "700",
    color: colors.textPrimary,
  },
  buttons: {
    flexDirection: "row",
    gap: 12,
  },
  rejectButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.error,
    alignItems: "center",
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.error,
  },
  acceptButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: colors.success,
    alignItems: "center",
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.white,
  },
});
