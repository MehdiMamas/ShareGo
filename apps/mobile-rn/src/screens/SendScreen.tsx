import React, { useContext, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { SessionContext } from "../App";
import { SessionState, decodeQrPayload } from "../lib/core";
import { StatusIndicator } from "../components/StatusIndicator";
import { QRScanner } from "../components/QRScanner";
import { CodeInput } from "../components/CodeInput";
import { colors } from "../styles/theme";

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList, "Send">;
}

type SendTab = "scan" | "code";

export function SendScreen({ navigation }: Props) {
  const ctx = useContext(SessionContext)!;
  const { session, transport } = ctx;
  const [tab, setTab] = useState<SendTab>("scan");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);

  // navigate to active session when connected
  useEffect(() => {
    if (session.state === SessionState.Active) {
      navigation.replace("ActiveSession");
    }
  }, [session.state, navigation]);

  const handleQrScanned = async (data: string) => {
    try {
      const payload = decodeQrPayload(data);
      setConnecting(true);
      setInputError(null);

      const t = transport.createSenderTransport();
      await session.startSender(
        t,
        { deviceName: "Mobile Sender" },
        payload.addr,
        payload.pk,
        payload.sid,
      );
    } catch (err) {
      setInputError(
        err instanceof Error ? err.message : "failed to connect via QR",
      );
      setConnecting(false);
    }
  };

  const handleManualConnect = async () => {
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
        { deviceName: "Mobile Sender" },
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
        {tab === "scan" && !connecting && (
          <QRScanner onScanned={handleQrScanned} />
        )}

        {tab === "code" && !connecting && (
          <View style={styles.codeForm}>
            <CodeInput value={code} onChange={setCode} />

            <TextInput
              style={styles.addressInput}
              value={address}
              onChangeText={setAddress}
              placeholder="192.168.1.100:4040"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={[
                styles.connectButton,
                (code.length !== 6 || !address) && styles.disabledButton,
              ]}
              disabled={isConnecting || code.length !== 6 || !address}
              onPress={handleManualConnect}
            >
              <Text style={styles.connectButtonText}>connect</Text>
            </TouchableOpacity>
          </View>
        )}

        {isConnecting && (
          <Text style={styles.statusText}>
            {session.state === SessionState.PendingApproval
              ? "waiting for approval..."
              : "connecting..."}
          </Text>
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
  addressInput: {
    width: 260,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontSize: 14,
    textAlign: "center",
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
