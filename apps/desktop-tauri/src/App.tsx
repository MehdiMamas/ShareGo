import { useState, useEffect } from "react";
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
  const session = useSession();
  const transport = useTransport();

  useEffect(() => {
    initCrypto().then(() => setReady(true));
  }, []);

  // auto-navigate based on session state
  useEffect(() => {
    if (session.state === SessionState.Active) {
      setScreen("active");
    }
    if (session.state === SessionState.Closed && screen !== "home") {
      setScreen("home");
    }
  }, [session.state, screen]);

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
          onBack={() => {
            session.endSession();
            setScreen("home");
          }}
        />
      );
    case "send":
      return (
        <SendScreen
          session={session}
          transport={transport}
          onBack={() => {
            session.endSession();
            setScreen("home");
          }}
        />
      );
    case "active":
      return (
        <ActiveSession
          session={session}
          onEnd={() => {
            session.endSession();
            setScreen("home");
          }}
        />
      );
    default:
      return (
        <HomeScreen
          onReceive={() => setScreen("receive")}
          onSend={() => setScreen("send")}
        />
      );
  }
}
