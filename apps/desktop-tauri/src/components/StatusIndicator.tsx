import { SessionState, strings } from "../lib/core";
import { colors } from "../styles/theme";

interface StatusIndicatorProps {
  state: SessionState;
}

export function StatusIndicator({ state }: StatusIndicatorProps) {
  const label = strings.STATUS_LABELS[state] ?? state;
  const colorMap: Record<string, string> = {
    Created: colors.textSecondary,
    WaitingForSender: colors.primary,
    Handshaking: colors.primary,
    PendingApproval: colors.primary,
    Active: colors.success,
    Rejected: colors.error,
    Closed: colors.textSecondary,
  };
  const color = colorMap[state] ?? colors.textSecondary;
  const info = { label, color };

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
