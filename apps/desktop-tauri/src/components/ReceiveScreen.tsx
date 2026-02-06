import { useEffect, useState, useRef } from "react";
import { SessionState } from "../lib/core";
import { colors } from "../styles/theme";
import { QRDisplay } from "./QRDisplay";
import { ApprovalDialog } from "./ApprovalDialog";
import { StatusIndicator } from "./StatusIndicator";
import type { useSession } from "../hooks/useSession";
import type { useTransport } from "../hooks/useTransport";

interface ReceiveScreenProps {
  session: ReturnType<typeof useSession>;
  transport: ReturnType<typeof useTransport>;
  onBack: () => void;
}

export function ReceiveScreen({
  session,
  transport,
  onBack,
}: ReceiveScreenProps) {
  const [started, setStarted] = useState(false);
  const [countdown, setCountdown] = useState(90);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const t = transport.createReceiverTransport();
    session
      .startReceiver(t, {
        deviceName: "Desktop",
        port: 4040,
        bootstrapTtl: 90,
      })
      .then(() => setStarted(true))
      .catch((err: unknown) => {
        console.error("failed to start receiver:", err);
      });
  }, [session, transport]);

  // countdown timer for bootstrap TTL
  useEffect(() => {
    if (!started) return;

    setCountdown(90);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [started]);

  const isWaiting =
    session.state === SessionState.WaitingForSender ||
    session.state === SessionState.Created;

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
          gap: 24,
        }}
      >
        {isWaiting && session.qrPayload && session.sessionId && (
          <>
            <QRDisplay
              value={session.qrPayload}
              sessionId={session.sessionId}
            />
            <div style={{ fontSize: 13, color: colors.textSecondary }}>
              expires in {countdown}s
            </div>
          </>
        )}

        {session.state === SessionState.Handshaking && (
          <p style={{ color: colors.textSecondary, fontSize: 14 }}>
            handshaking with sender...
          </p>
        )}

        {session.error && (
          <p style={{ color: colors.error, fontSize: 14 }}>{session.error}</p>
        )}
      </div>

      {/* approval dialog */}
      {session.pairingRequest && (
        <ApprovalDialog
          request={session.pairingRequest}
          onApprove={session.approve}
          onReject={() => session.reject("user rejected")}
        />
      )}
    </div>
  );
}
