import { QRCodeSVG } from "qrcode.react";
import { colors } from "../styles/theme";

interface QRDisplayProps {
  value: string;
  sessionId: string;
}

export function QRDisplay({ value, sessionId }: QRDisplayProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div style={{ padding: 16, borderRadius: 12, background: "#ffffff" }}>
        <QRCodeSVG
          value={value}
          size={200}
          level="M"
          bgColor="#ffffff"
          fgColor="#000000"
        />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
        }}
      >
        <span style={{ fontSize: 12, color: colors.textSecondary }}>
          manual code
        </span>
        <span
          style={{
            fontSize: 24,
            fontWeight: 700,
            fontFamily: "monospace",
            color: colors.textPrimary,
            letterSpacing: 4,
          }}
        >
          {sessionId}
        </span>
      </div>
    </div>
  );
}
