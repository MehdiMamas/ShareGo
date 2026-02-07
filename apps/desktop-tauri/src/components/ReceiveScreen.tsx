import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  SessionState,
  DEFAULT_PORT,
  BOOTSTRAP_TTL,
  REGENERATION_DELAY_MS,
  COUNTDOWN_INTERVAL_MS,
} from "../lib/core";
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
  const { t } = useTranslation();
  const bootstrapTtl = BOOTSTRAP_TTL;
  const [started, setStarted] = useState(false);
  const [countdown, setCountdown] = useState(bootstrapTtl);
  const [initError, setInitError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const sessionRef = useRef(session);
  const transportRef = useRef(transport);
  sessionRef.current = session;
  transportRef.current = transport;

  const startSession = useCallback(() => {
    setStarted(false);
    setCountdown(bootstrapTtl);
    setInitError(null);

    const receiverTransport = transportRef.current.createReceiverTransport();
    sessionRef.current
      .startReceiver(receiverTransport, {
        deviceName: "Desktop",
        port: DEFAULT_PORT,
        bootstrapTtl,
      })
      .then(() => {
        setStarted(true);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("failed to start receiver:", msg);
        setInitError(msg);
      });
  }, []);

  // start on mount
  useEffect(() => {
    startSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // countdown timer
  useEffect(() => {
    if (!started) return;

    setCountdown(bootstrapTtl);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, COUNTDOWN_INTERVAL_MS);

    return () => clearInterval(timerRef.current);
  }, [started]);

  // auto-regenerate when expired
  const regeneratingRef = useRef(false);
  useEffect(() => {
    if (countdown !== 0 || !started || regeneratingRef.current) return;
    regeneratingRef.current = true;

    const regen = async () => {
      sessionRef.current.endSession();
      await new Promise((r) => setTimeout(r, REGENERATION_DELAY_MS));
      startSession();
      regeneratingRef.current = false;
    };
    regen();
  }, [countdown, started, startSession]);

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
          {t("common.back")}
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
        {!started && !initError && (
          <p style={{ color: colors.textSecondary, fontSize: 14 }}>
            {t("receive.starting")}
          </p>
        )}

        {initError && (
          <p style={{ color: colors.error, fontSize: 14 }}>
            {t("receive.failedStart", { detail: initError })}
          </p>
        )}

        {isWaiting && session.qrPayload && session.sessionId && (
          <>
            <QRDisplay
              value={session.qrPayload}
              sessionId={session.sessionId}
              address={session.localAddress ?? undefined}
            />
            {countdown === 0 ? (
              <div style={{ fontSize: 13, color: colors.textSecondary }}>
                {t("receive.regenerating")}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: colors.textSecondary }}>
                {t("receive.expires", { seconds: countdown })}
              </div>
            )}
          </>
        )}

        {started && isWaiting && !session.qrPayload && (
          <p style={{ color: colors.textSecondary, fontSize: 14 }}>
            {t("receive.waitingQr")}
          </p>
        )}

        {session.state === SessionState.Handshaking && (
          <p style={{ color: colors.textSecondary, fontSize: 14 }}>
            {t("receive.handshaking")}
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
          onReject={() => session.reject(t("common.rejectionReason"))}
        />
      )}
    </div>
  );
}
