import { useEffect } from "react";
import { strings } from "../lib/core";
import { colors } from "../styles/theme";
import type { PairingRequest } from "../lib/core";

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
  // keyboard shortcuts: Enter to approve, Escape to reject
  useEffect(() => {
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
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.6)",
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: colors.surface,
          borderRadius: 16,
          padding: 32,
          maxWidth: 360,
          width: "90%",
          border: `1px solid ${colors.border}`,
        }}
      >
        <h3
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: colors.textPrimary,
            marginBottom: 12,
          }}
        >
          {strings.DIALOG_TITLE}
        </h3>

        <p
          style={{
            fontSize: 14,
            color: colors.textSecondary,
            lineHeight: 1.5,
            marginBottom: 24,
          }}
        >
          {strings.DIALOG_BODY(request.deviceName)}
        </p>

        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={onReject}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: 10,
              background: "transparent",
              color: colors.error,
              fontSize: 14,
              fontWeight: 600,
              border: `1px solid ${colors.error}`,
            }}
          >
            {strings.BTN_REJECT}
          </button>
          <button
            onClick={onApprove}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: 10,
              background: colors.success,
              color: colors.white,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {strings.BTN_ACCEPT}
          </button>
        </div>
      </div>
    </div>
  );
}
