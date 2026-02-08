import React, { useContext, useEffect, useRef, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { ScreenContainer } from "../components/ScreenContainer";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { SessionContext } from "../App";
import {
  SessionState,
  DEFAULT_PORT,
  BOOTSTRAP_TTL,
  REGENERATION_DELAY_MS,
  COUNTDOWN_INTERVAL_MS,
  DEVICE_NAME_RECEIVER,
  en,
} from "../lib/core";
import { QRDisplay } from "../components/QRDisplay";
import { ApprovalDialog } from "../components/ApprovalDialog";
import { StatusIndicator } from "../components/StatusIndicator";
import { colors } from "../styles/theme";

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList, "Receive">;
}

export function ReceiveScreen({ navigation }: Props) {
  const ctx = useContext(SessionContext)!;
  const { session, transport } = ctx;
  // keep refs to avoid stale closures in effects
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const bootstrapTtl = BOOTSTRAP_TTL;
  const [started, setStarted] = useState(false);
  const [countdown, setCountdown] = useState(bootstrapTtl);
  const [initError, setInitError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const transportRef = useRef(transport);
  transportRef.current = transport;

  const startSession = useCallback(() => {
    setStarted(false);
    setCountdown(bootstrapTtl);
    setInitError(null);

    const transportInstance = transportRef.current.createReceiverTransport();
    sessionRef.current
      .startReceiver(transportInstance, {
        deviceName: DEVICE_NAME_RECEIVER,
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

  // navigate to active session when connected
  useEffect(() => {
    if (session.state === SessionState.Active) {
      navigation.replace("ActiveSession");
    }
  }, [session.state, navigation]);

  // auto-regenerate when expired (only when still waiting — never during handshake/active)
  const regeneratingRef = useRef(false);
  useEffect(() => {
    if (countdown !== 0 || !started || regeneratingRef.current) return;
    // guard: don't regenerate if the session has already progressed past waiting
    const state = sessionRef.current.state;
    if (
      state !== SessionState.WaitingForSender &&
      state !== SessionState.Created
    ) {
      return;
    }
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
    <ScreenContainer style={styles.container}>
      {/* header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            session.endSession();
            navigation.goBack();
          }}
        >
          <Text style={styles.backButtonText}>{en.common.back}</Text>
        </TouchableOpacity>
        <StatusIndicator state={session.state} />
      </View>

      {/* content */}
      <View style={styles.content}>
        {!started && !initError && (
          <Text style={styles.statusText}>{en.receive.starting}</Text>
        )}

        {initError && (
          <Text style={styles.errorText}>{en.receive.failedStart.replace("{{detail}}", initError)}</Text>
        )}

        {isWaiting && session.qrPayload && session.sessionId && (
          <>
            <QRDisplay
              value={session.qrPayload}
              sessionId={session.sessionId}
              address={session.localAddress ?? undefined}
            />
            {countdown === 0 ? (
              <Text style={styles.expires}>{en.receive.regenerating}</Text>
            ) : (
              <Text style={styles.expires}>
                {en.receive.expires.replace("{{seconds}}", String(countdown))}
              </Text>
            )}
          </>
        )}

        {started && isWaiting && !session.qrPayload && (
          <Text style={styles.statusText}>{en.receive.waitingQr}</Text>
        )}

        {session.state === SessionState.Handshaking && (
          <Text style={styles.statusText}>{en.receive.handshaking}</Text>
        )}

        {session.error && (
          <Text style={styles.errorText}>{session.error}</Text>
        )}
      </View>

      {/* approval dialog */}
      {session.pairingRequest && (
        <ApprovalDialog
          request={session.pairingRequest}
          onApprove={session.approve}
          onReject={() => session.reject(en.common.rejectionReason)}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backButtonText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  expires: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  statusText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
  },
});
