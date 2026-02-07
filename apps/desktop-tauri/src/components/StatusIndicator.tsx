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
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: info.color,
        }}
      />
      <span style={{ fontSize: 13, color: info.color, fontWeight: 500 }}>
        {info.label}
      </span>
    </div>
  );
}
