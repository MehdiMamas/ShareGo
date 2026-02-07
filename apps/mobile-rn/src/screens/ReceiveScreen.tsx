import React, { useContext, useEffect, useRef, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { SessionContext } from "../App";
import {
  SessionState,
  DEFAULT_PORT,
  BOOTSTRAP_TTL,
  REGENERATION_DELAY_MS,
  COUNTDOWN_INTERVAL_MS,
} from "../lib/core";
import { QRDisplay } from "../components/QRDisplay";
import { ApprovalDialog } from "../components/ApprovalDialog";
import { StatusIndicator } from "../components/StatusIndicator";
import { colors } from "../styles/theme";

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList, "Receive">;
}

export function ReceiveScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const ctx = useContext(SessionContext)!;
  const { session, transport } = ctx;
  const bootstrapTtl = BOOTSTRAP_TTL;
  const [started, setStarted] = useState(false);
  const [countdown, setCountdown] = useState(bootstrapTtl);
  const [initError, setInitError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const startSession = useCallback(() => {
    setStarted(false);
    setCountdown(bootstrapTtl);
    setInitError(null);

    const transportInstance = transport.createReceiverTransport();
    session
      .startReceiver(transportInstance, {
        deviceName: "Mobile",
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
  }, [session, transport]);

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

  // auto-regenerate when expired
  const regeneratingRef = useRef(false);
  useEffect(() => {
    if (countdown !== 0 || !started || regeneratingRef.current) return;
    regeneratingRef.current = true;

    const regen = async () => {
      session.endSession();
      await new Promise((r) => setTimeout(r, REGENERATION_DELAY_MS));
      startSession();
      regeneratingRef.current = false;
    };
    regen();
  }, [countdown, started, session, startSession]);

  const isWaiting =
    session.state === SessionState.WaitingForSender ||
    session.state === SessionState.Created;

  return (
    <SafeAreaView style={styles.container}>
      {/* header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            session.endSession();
            navigation.goBack();
          }}
        >
          <Text style={styles.backButtonText}>{t("common.back")}</Text>
        </TouchableOpacity>
        <StatusIndicator state={session.state} />
      </View>

      {/* content */}
      <View style={styles.content}>
        {!started && !initError && (
          <Text style={styles.statusText}>{t("receive.starting")}</Text>
        )}

        {initError && (
          <Text style={styles.errorText}>{t("receive.failedStart", { detail: initError })}</Text>
        )}

        {isWaiting && session.qrPayload && session.sessionId && (
          <>
            <QRDisplay
              value={session.qrPayload}
              sessionId={session.sessionId}
              address={session.localAddress ?? undefined}
            />
            {countdown === 0 ? (
              <Text style={styles.expires}>{t("receive.regenerating")}</Text>
            ) : (
              <Text style={styles.expires}>
                {t("receive.expires", { seconds: countdown })}
              </Text>
            )}
          </>
        )}

        {started && isWaiting && !session.qrPayload && (
          <Text style={styles.statusText}>{t("receive.waitingQr")}</Text>
        )}

        {session.state === SessionState.Handshaking && (
          <Text style={styles.statusText}>{t("receive.handshaking")}</Text>
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
          onReject={() => session.reject(t("common.rejectionReason"))}
        />
      )}
    </SafeAreaView>
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
    marginBottom: 24,
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
    gap: 24,
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
