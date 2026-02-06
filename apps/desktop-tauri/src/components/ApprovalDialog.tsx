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
          pairing request
        </h3>

        <p
          style={{
            fontSize: 14,
            color: colors.textSecondary,
            lineHeight: 1.5,
            marginBottom: 24,
          }}
        >
          <strong style={{ color: colors.textPrimary }}>
            {request.deviceName}
          </strong>{" "}
          wants to connect. allow this device?
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
            reject
          </button>
          <button
            onClick={onApprove}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: 10,
              background: colors.success,
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            accept
          </button>
        </div>
      </div>
    </div>
  );
}
