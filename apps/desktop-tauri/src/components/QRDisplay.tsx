import { useTranslation } from "react-i18next";
import { QRCodeSVG } from "qrcode.react";
import { colors } from "../styles/theme";

interface QRDisplayProps {
  value: string;
  sessionId: string;
  address?: string;
}

export function QRDisplay({ value, sessionId, address }: QRDisplayProps) {
  const { t } = useTranslation();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div style={{ padding: 16, borderRadius: 12, background: colors.white }}>
        <QRCodeSVG
          value={value}
          size={200}
          level="M"
          bgColor={colors.white}
          fgColor={colors.black}
        />
      </div>

      <span style={{ fontSize: 12, color: colors.textSecondary }}>
        {t("qr.hint")}
      </span>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          padding: "12px 20px",
          borderRadius: 10,
          background: colors.surface,
          border: `1px solid ${colors.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: colors.textSecondary }}>
            {t("qr.codeLabel")}
          </span>
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              fontFamily: "monospace",
              color: colors.textPrimary,
              letterSpacing: 4,
            }}
          >
            {sessionId}
          </span>
        </div>

        {address && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: colors.textSecondary }}>
              {t("qr.addressLabel")}
            </span>
            <span
              style={{
                fontSize: 14,
                fontFamily: "monospace",
                color: colors.textPrimary,
              }}
            >
              {address}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
