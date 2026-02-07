import { useState, useRef, useEffect } from "react";
import { SessionState, decodeQrPayload, DEFAULT_PORT } from "../lib/core";
import { discoverReceiver } from "@sharego/core";
import { colors } from "../styles/theme";
import { StatusIndicator } from "./StatusIndicator";
import { QRScanner } from "./QRScanner";
import type { useSession } from "../hooks/useSession";
import type { useTransport } from "../hooks/useTransport";

interface SendScreenProps {
  session: ReturnType<typeof useSession>;
  transport: ReturnType<typeof useTransport>;
  onBack: () => void;
}

type SendTab = "scan" | "code";

/** resolve local IP via tauri command */
async function getTauriLocalIp(): Promise<string | null> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("get_local_ip");
}

export function SendScreen({ session, transport, onBack }: SendScreenProps) {
  const [tab, setTab] = useState<SendTab>("scan");
  const [code, setCode] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const discoveryAbortRef = useRef<AbortController | null>(null);

  const connectToReceiver = async (
    addr: string,
    pk?: string,
    sid?: string,
  ) => {
    setConnecting(true);
    setInputError(null);
    try {
      const t = transport.createSenderTransport();
      await session.startSender(
        t,
        { deviceName: "Desktop Sender" },
        addr,
        pk,
        sid ?? code,
      );
    } catch (err) {
      setInputError(
        err instanceof Error ? err.message : "connection failed",
      );
      setConnecting(false);
    }
  };

  const handleQrScanned = async (data: string) => {
    try {
      const payload = decodeQrPayload(data);
      setCode(payload.sid);
      await connectToReceiver(payload.addr, payload.pk, payload.sid);
    } catch (err) {
      setInputError(
        err instanceof Error ? err.message : "invalid QR code",
      );
    }
  };

  const handleManualConnect = async () => {
    if (code.length !== 6) {
      setInputError("enter a 6-character code");
      return;
    }

    setInputError(null);
    setDiscovering(true);

    // create an abort controller so discovery can be cancelled
    discoveryAbortRef.current?.abort();
    const controller = new AbortController();
    discoveryAbortRef.current = controller;

    try {
      const addr = await discoverReceiver({
        sessionCode: code,
        port: DEFAULT_PORT,
        getLocalIp: getTauriLocalIp,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!addr) {
        setInputError("could not find receiver on your network — make sure both devices are on the same WiFi");
        setDiscovering(false);
        return;
      }
      setDiscovering(false);
      await connectToReceiver(addr, undefined, code);
    } catch (err) {
      if (controller.signal.aborted) return;
      setInputError(
        err instanceof Error ? err.message : "discovery failed",
      );
      setDiscovering(false);
    }
  };

  const handleCancel = () => {
    discoveryAbortRef.current?.abort();
    discoveryAbortRef.current = null;
    session.endSession();
    setConnecting(false);
    setDiscovering(false);
    setInputError(null);
  };

  // abort discovery on unmount
  useEffect(() => {
    return () => {
      discoveryAbortRef.current?.abort();
    };
  }, []);

  const isConnecting = session.state === SessionState.Handshaking || connecting;
  const isWaitingApproval = session.state === SessionState.PendingApproval;
  const isBusy = isConnecting || isWaitingApproval || discovering;

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
          marginBottom: 16,
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
          back
        </button>
        <StatusIndicator state={session.state} />
      </div>

      {/* tab switcher */}
      <div
        style={{
          display: "flex",
          background: colors.surface,
          borderRadius: 10,
          padding: 4,
          marginBottom: 24,
          maxWidth: 400,
          alignSelf: "center",
          width: "100%",
        }}
      >
        <button
          onClick={() => setTab("scan")}
          style={{
            flex: 1,
            padding: "10px 0",
            borderRadius: 8,
            background: tab === "scan" ? colors.primary : "transparent",
            color: tab === "scan" ? colors.textPrimary : colors.textSecondary,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          scan QR
        </button>
        <button
          onClick={() => setTab("code")}
          style={{
            flex: 1,
            padding: "10px 0",
            borderRadius: 8,
            background: tab === "code" ? colors.primary : "transparent",
            color: tab === "code" ? colors.textPrimary : colors.textSecondary,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          enter code
        </button>
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
        {/* scan QR tab — uses webcam */}
        {tab === "scan" && !isBusy && (
          <QRScanner onScanned={handleQrScanned} />
        )}

        {/* enter code tab — no IP needed */}
        {tab === "code" && !isBusy && (
          <>
            <p style={{ fontSize: 13, color: colors.textSecondary, textAlign: "center" }}>
              enter the 6-character code shown on the receiver
            </p>

            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="ABC123"
              maxLength={6}
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

            <button
              onClick={handleManualConnect}
              disabled={code.length !== 6}
              style={{
                padding: "14px 32px",
                borderRadius: 10,
                background: colors.primary,
                color: colors.textPrimary,
                fontSize: 15,
                fontWeight: 600,
                opacity: code.length !== 6 ? 0.5 : 1,
              }}
            >
              connect
            </button>
          </>
        )}

        {/* discovering state */}
        {discovering && (
          <>
            <p style={{ fontSize: 14, color: colors.textSecondary }}>
              searching for receiver on your network...
            </p>
            <button
              onClick={handleCancel}
              style={{
                padding: "10px 24px",
                borderRadius: 10,
                background: "transparent",
                color: colors.error,
                fontSize: 14,
                fontWeight: 600,
                border: `1px solid ${colors.error}`,
              }}
            >
              cancel
            </button>
          </>
        )}

        {/* connecting / waiting state */}
        {(isConnecting || isWaitingApproval) && !discovering && (
          <>
            <p style={{ fontSize: 14, color: colors.textSecondary }}>
              {isWaitingApproval
                ? "waiting for approval..."
                : "connecting..."}
            </p>
            <button
              onClick={handleCancel}
              style={{
                padding: "10px 24px",
                borderRadius: 10,
                background: "transparent",
                color: colors.error,
                fontSize: 14,
                fontWeight: 600,
                border: `1px solid ${colors.error}`,
              }}
            >
              cancel
            </button>
          </>
        )}

        {inputError && (
          <p style={{ color: colors.error, fontSize: 13, textAlign: "center" }}>
            {inputError}
          </p>
        )}

        {session.error && (
          <p style={{ color: colors.error, fontSize: 13, textAlign: "center" }}>
            {session.error}
          </p>
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
