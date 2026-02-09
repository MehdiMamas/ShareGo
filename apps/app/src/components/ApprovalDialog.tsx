import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform } from "react-native";
import type { PairingRequest } from "../lib/core";
import { en } from "../lib/core";
import { colors } from "../styles/theme";

interface ApprovalDialogProps {
  request: PairingRequest;
  onApprove: () => void;
  onReject: () => void;
}

export function ApprovalDialog({ request, onApprove, onReject }: ApprovalDialogProps) {
  // keyboard shortcuts for web/electron: Enter=approve, Escape=reject
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onApprove();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onReject();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onApprove, onReject]);

  return (
    <Modal transparent animationType="fade" visible>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <Text style={styles.title}>{en.approval.title}</Text>
          <Text style={styles.message}>
            {en.approval.body.replace("{{deviceName}}", request.deviceName)}
          </Text>

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.rejectButton} onPress={onReject}>
              <Text style={styles.rejectButtonText}>{en.approval.reject}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptButton} onPress={onApprove}>
              <Text style={styles.acceptButtonText}>{en.approval.accept}</Text>
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
    backgroundColor: colors.overlay,
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
