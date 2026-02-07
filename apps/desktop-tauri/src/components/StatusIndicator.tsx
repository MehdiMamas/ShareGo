import { useTranslation } from "react-i18next";
import { SessionState } from "../lib/core";
import { colors } from "../styles/theme";

interface StatusIndicatorProps {
  state: SessionState;
}

export function StatusIndicator({ state }: StatusIndicatorProps) {
  const { t } = useTranslation();
  const labelMap: Record<SessionState, string> = {
    [SessionState.Created]: t("status.created"),
    [SessionState.WaitingForSender]: t("status.waitingForSender"),
    [SessionState.Handshaking]: t("status.handshaking"),
    [SessionState.PendingApproval]: t("status.pendingApproval"),
    [SessionState.Active]: t("status.active"),
    [SessionState.Rejected]: t("status.rejected"),
    [SessionState.Closed]: t("status.closed"),
  };
  const label = labelMap[state] ?? state;
  const colorMap: Record<SessionState, string> = {
    [SessionState.Created]: colors.textSecondary,
    [SessionState.WaitingForSender]: colors.primary,
    [SessionState.Handshaking]: colors.primary,
    [SessionState.PendingApproval]: colors.primary,
    [SessionState.Active]: colors.success,
    [SessionState.Rejected]: colors.error,
    [SessionState.Closed]: colors.textSecondary,
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
