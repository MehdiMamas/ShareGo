import { useState, useEffect, useCallback } from "react";
import { initCrypto, SessionState } from "./lib/core";
import { useSession } from "./hooks/useSession";
import { useTransport } from "./hooks/useTransport";
import { HomeScreen } from "./components/HomeScreen";
import { ReceiveScreen } from "./components/ReceiveScreen";
import { SendScreen } from "./components/SendScreen";
import { ActiveSession } from "./components/ActiveSession";
import { colors } from "./styles/theme";

type AppScreen = "home" | "receive" | "send" | "active";

export default function App() {
  const [screen, setScreen] = useState<AppScreen>("home");
  const [ready, setReady] = useState(false);
  const [cryptoError, setCryptoError] = useState<string | null>(null);
  const session = useSession();
  const transport = useTransport();

  useEffect(() => {
    initCrypto()
      .then(() => setReady(true))
      .catch((err) => {
        setCryptoError(
          err instanceof Error ? err.message : "failed to initialize crypto",
        );
      });
  }, []);

  // auto-navigate to active session when handshake completes
  useEffect(() => {
    if (session.state === SessionState.Active) {
      setScreen("active");
    }
  }, [session.state]);

  // navigate to a screen, ensuring any previous session is cleaned up
  const navigateTo = useCallback(
    (target: AppScreen) => {
      if (session.state !== SessionState.Created) {
        session.endSession();
      }
      setScreen(target);
    },
    [session],
  );

  if (cryptoError) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: colors.background,
          gap: 12,
        }}
      >
        <p style={{ color: colors.error, fontSize: 16, fontWeight: 600 }}>
          crypto initialization failed
        </p>
        <p style={{ color: colors.textSecondary, fontSize: 13 }}>
          {cryptoError}
        </p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: colors.background,
          color: colors.textSecondary,
          fontSize: 14,
        }}
      >
        initializing crypto...
      </div>
    );
  }

  switch (screen) {
    case "receive":
      return (
        <ReceiveScreen
          session={session}
          transport={transport}
          onBack={() => navigateTo("home")}
        />
      );
    case "send":
      return (
        <SendScreen
          session={session}
          transport={transport}
          onBack={() => navigateTo("home")}
        />
      );
    case "active":
      return (
        <ActiveSession
          session={session}
          onEnd={() => navigateTo("home")}
        />
      );
    default:
      return (
        <HomeScreen
          onReceive={() => navigateTo("receive")}
          onSend={() => navigateTo("send")}
        />
      );
  }
}
