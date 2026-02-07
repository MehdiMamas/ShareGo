import React, { useContext, useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NetworkInfo } from "react-native-network-info";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { SessionContext } from "../App";
import { SessionState, decodeQrPayload, DEFAULT_PORT } from "../lib/core";
import { discoverReceiver } from "@sharego/core";
import { StatusIndicator } from "../components/StatusIndicator";
import { QRScanner } from "../components/QRScanner";
import { colors } from "../styles/theme";

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList, "Send">;
}

/** resolve local IP via react-native-network-info */
async function getRnLocalIp(): Promise<string | null> {
  return NetworkInfo.getIPV4Address();
}

export function SendScreen({ navigation }: Props) {
  const ctx = useContext(SessionContext)!;
  const { session, transport } = ctx;
  const [tab, setTab] = useState<"scan" | "code">("scan");
  const [code, setCode] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const discoveryAbortRef = useRef<AbortController | null>(null);

  // abort discovery on unmount
  useEffect(() => {
    return () => {
      discoveryAbortRef.current?.abort();
    };
  }, []);

  // navigate to active session when connected
  useEffect(() => {
    if (session.state === SessionState.Active) {
      navigation.replace("ActiveSession");
    }
  }, [session.state, navigation]);

  const connectToReceiver = useCallback(
    async (addr: string, pk?: string, sid?: string) => {
      setConnecting(true);
      setInputError(null);
      try {
        const t = transport.createSenderTransport();
        await session.startSender(
          t,
          { deviceName: "Mobile Sender" },
          addr,
          pk,
          sid,
        );
      } catch (err) {
        setInputError(
          err instanceof Error ? err.message : "connection failed",
        );
        setConnecting(false);
      }
    },
    [session, transport],
  );

  const handleQrScanned = useCallback(
    async (data: string) => {
      try {
        const payload = decodeQrPayload(data);
        await connectToReceiver(payload.addr, payload.pk, payload.sid);
      } catch (err) {
        setInputError(
          err instanceof Error ? err.message : "invalid QR code",
        );
      }
    },
    [connectToReceiver],
  );

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
        getLocalIp: getRnLocalIp,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!addr) {
        setInputError(
          "could not find receiver on your network — make sure both devices are on the same WiFi",
        );
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

  const isConnecting = session.state === SessionState.Handshaking || connecting;

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

      {/* tab switcher */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === "scan" && styles.activeTab]}
          onPress={() => setTab("scan")}
        >
          <Text
            style={[
              styles.tabText,
              tab === "scan" && styles.activeTabText,
            ]}
          >
            scan QR
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "code" && styles.activeTab]}
          onPress={() => setTab("code")}
        >
          <Text
            style={[
              styles.tabText,
              tab === "code" && styles.activeTabText,
            ]}
          >
            enter code
          </Text>
        </TouchableOpacity>
      </View>

      {/* content */}
      <View style={styles.content}>
        {tab === "scan" && !connecting && !discovering && (
          <QRScanner onScanned={handleQrScanned} />
        )}

        {tab === "code" && !connecting && !discovering && (
          <View style={styles.codeForm}>
            <Text style={styles.hintText}>
              enter the 6-character code shown on the receiver
            </Text>

            <TextInput
              style={styles.codeInput}
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase().slice(0, 6))}
              placeholder="ABC123"
              placeholderTextColor={colors.textSecondary}
              maxLength={6}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={[
                styles.connectButton,
                code.length !== 6 && styles.disabledButton,
              ]}
              disabled={isConnecting || code.length !== 6}
              onPress={handleManualConnect}
            >
              <Text style={styles.connectButtonText}>connect</Text>
            </TouchableOpacity>
          </View>
        )}

        {discovering && (
          <>
            <Text style={styles.statusText}>
              searching for receiver on your network...
            </Text>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
            >
              <Text style={styles.cancelButtonText}>cancel</Text>
            </TouchableOpacity>
          </>
        )}

        {isConnecting && !discovering && (
          <>
            <Text style={styles.statusText}>
              {session.state === SessionState.PendingApproval
                ? "waiting for approval..."
                : "connecting..."}
            </Text>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
            >
              <Text style={styles.cancelButtonText}>cancel</Text>
            </TouchableOpacity>
          </>
        )}

        {inputError && <Text style={styles.errorText}>{inputError}</Text>}
        {session.error && (
          <Text style={styles.errorText}>{session.error}</Text>
        )}
        {session.state === SessionState.Rejected && (
          <Text style={styles.errorText}>
            connection was rejected by the receiver
          </Text>
        )}
      </View>
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
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.textPrimary,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  codeForm: {
    width: "100%",
    alignItems: "center",
    gap: 16,
  },
  hintText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
  },
  codeInput: {
    width: 200,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontSize: 24,
    fontFamily: "monospace",
    textAlign: "center",
    letterSpacing: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  connectButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  disabledButton: {
    opacity: 0.5,
  },
  connectButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.error,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.error,
  },
  statusText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  errorText: {
    fontSize: 13,
    color: colors.error,
    textAlign: "center",
  },
});
