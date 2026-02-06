import React, { useContext, useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { SessionContext } from "../App";
import { SessionState } from "../lib/core";
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
        deviceName: "Mobile",
        port: 4040,
        bootstrapTtl: 90,
      })
      .then(() => setStarted(true))
      .catch((err: unknown) => {
        console.error("failed to start receiver:", err);
      });
  }, [session, transport]);

  // countdown timer
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

  // navigate to active session when connected
  useEffect(() => {
    if (session.state === SessionState.Active) {
      navigation.replace("ActiveSession");
    }
  }, [session.state, navigation]);

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
          <Text style={styles.backButtonText}>back</Text>
        </TouchableOpacity>
        <StatusIndicator state={session.state} />
      </View>

      {/* content */}
      <View style={styles.content}>
        {isWaiting && session.qrPayload && session.sessionId && (
          <>
            <QRDisplay
              value={session.qrPayload}
              sessionId={session.sessionId}
            />
            <Text style={styles.expires}>expires in {countdown}s</Text>
          </>
        )}

        {session.state === SessionState.Handshaking && (
          <Text style={styles.statusText}>handshaking with sender...</Text>
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
          onReject={() => session.reject("user rejected")}
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
