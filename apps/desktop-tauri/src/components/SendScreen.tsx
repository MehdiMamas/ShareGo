import { useState } from "react";
import { SessionState } from "../lib/core";
import { colors } from "../styles/theme";
import { StatusIndicator } from "./StatusIndicator";
import type { useSession } from "../hooks/useSession";
import type { useTransport } from "../hooks/useTransport";

interface SendScreenProps {
  session: ReturnType<typeof useSession>;
  transport: ReturnType<typeof useTransport>;
  onBack: () => void;
}

export function SendScreen({ session, transport, onBack }: SendScreenProps) {
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);

  const handleConnect = async () => {
    if (code.length !== 6) {
      setInputError("enter a 6-character code");
      return;
    }
    if (!address) {
      setInputError("enter the receiver's address (ip:port)");
      return;
    }

    setInputError(null);
    setConnecting(true);

    try {
      const t = transport.createSenderTransport();
      await session.startSender(
        t,
        { deviceName: "Desktop Sender" },
        address,
        undefined,
        code,
      );
    } catch (err) {
      setInputError(
        err instanceof Error ? err.message : "connection failed",
      );
      setConnecting(false);
    }
  };

  const isConnecting = session.state === SessionState.Handshaking || connecting;
  const isWaitingApproval = session.state === SessionState.PendingApproval;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: colors.background,
        padding: 24,
      }}
    >
      {/* header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <button
          onClick={onBack}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            background: colors.surface,
            color: colors.textSecondary,
            fontSize: 13,
            border: `1px solid ${colors.border}`,
          }}
        >
          &larr; back
        </button>
        <StatusIndicator state={session.state} />
      </div>

      {/* content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
        }}
      >
        <h2
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: colors.textPrimary,
          }}
        >
          enter pairing code
        </h2>

        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
          placeholder="ABC123"
          maxLength={6}
          disabled={isConnecting || isWaitingApproval}
          style={{
            width: 200,
            padding: "14px 20px",
            borderRadius: 10,
            background: colors.surface,
            color: colors.textPrimary,
            fontSize: 24,
            fontFamily: "monospace",
            textAlign: "center",
            letterSpacing: 6,
            border: `1px solid ${colors.border}`,
          }}
        />

        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="192.168.1.100:4040"
          disabled={isConnecting || isWaitingApproval}
          style={{
            width: 260,
            padding: "12px 16px",
            borderRadius: 10,
            background: colors.surface,
            color: colors.textPrimary,
            fontSize: 14,
            textAlign: "center",
            border: `1px solid ${colors.border}`,
          }}
        />

        <button
          onClick={handleConnect}
          disabled={
            isConnecting ||
            isWaitingApproval ||
            code.length !== 6 ||
            !address
          }
          style={{
            padding: "14px 32px",
            borderRadius: 10,
            background:
              isConnecting || isWaitingApproval
                ? colors.border
                : colors.primary,
            color: colors.textPrimary,
            fontSize: 15,
            fontWeight: 600,
            opacity: code.length !== 6 || !address ? 0.5 : 1,
          }}
        >
          {isConnecting
            ? "connecting..."
            : isWaitingApproval
              ? "waiting for approval..."
              : "connect"}
        </button>

        {inputError && (
          <p style={{ color: colors.error, fontSize: 13 }}>{inputError}</p>
        )}

        {session.error && (
          <p style={{ color: colors.error, fontSize: 13 }}>{session.error}</p>
        )}

        {session.state === SessionState.Rejected && (
          <p style={{ color: colors.error, fontSize: 14 }}>
            connection was rejected by the receiver
          </p>
        )}
      </div>
    </div>
  );
}
