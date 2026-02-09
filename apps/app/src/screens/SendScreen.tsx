import React, { useContext, useEffect, useState, useCallback, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { ScreenContainer } from "../components/ScreenContainer";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { SessionContext } from "../App";
import {
  SessionState,
  decodeQrPayload,
  DEFAULT_PORT,
  SESSION_CODE_LENGTH,
  CODE_PLACEHOLDER,
  DEVICE_NAME_SENDER,
  discoverReceiver,
  asSessionId,
  en,
  MDNS_SERVICE_TYPE,
  MDNS_BROWSE_TIMEOUT_MS,
  log,
} from "../lib/core";
import { StatusIndicator } from "../components/StatusIndicator";
import { QRScanner } from "../components/QRScanner";
import { colors } from "../styles/theme";
import { getLocalIp } from "../adapters/network";
import { isElectron } from "../platform";

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList, "Send">;
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

  // keep a ref to session so the unmount cleanup doesn't depend on the object identity
  const sessionRef = useRef(session);
  sessionRef.current = session;

  // abort discovery on unmount — never end the session here;
  // the session is ended explicitly by the user via back/cancel buttons
  // or by the ActiveSession screen's end button.
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
        await session.startSender(t, { deviceName: DEVICE_NAME_SENDER }, addr, pk, sid);
      } catch (err) {
        setInputError(err instanceof Error ? err.message : en.send.errorConnectionFailed);
      } finally {
        setConnecting(false);
      }
    },
    [session, transport],
  );

  const handleQrScanned = useCallback(
    async (data: string) => {
      try {
        const payload = decodeQrPayload(data);
        await connectToReceiver(
          payload.addr as string,
          payload.pk as string,
          payload.sid as string,
        );
      } catch (err) {
        setInputError(err instanceof Error ? err.message : en.send.errorInvalidQr);
      }
    },
    [connectToReceiver],
  );

  const handleManualConnect = async () => {
    if (code.length !== SESSION_CODE_LENGTH) {
      setInputError(en.send.errorCodeLength);
      return;
    }

    setInputError(null);
    setDiscovering(true);

    discoveryAbortRef.current?.abort();
    const controller = new AbortController();
    discoveryAbortRef.current = controller;

    try {
      // on electron, try mDNS first via main-process IPC (avoids 254 subnet connections)
      if (isElectron && window.electronAPI?.mdnsBrowse) {
        log.debug("[send] trying mDNS discovery via IPC...");
        const mdnsResult = await window.electronAPI.mdnsBrowse(
          MDNS_SERVICE_TYPE,
          code,
          MDNS_BROWSE_TIMEOUT_MS,
        );
        if (controller.signal.aborted) return;
        if (mdnsResult) {
          log.debug(`[send] mDNS found receiver at ${mdnsResult.address}`);
          setDiscovering(false);
          await connectToReceiver(mdnsResult.address, mdnsResult.publicKey ?? undefined, code);
          return;
        }
        log.debug("[send] mDNS found nothing, falling back to subnet scan");
      }

      // fall back to subnet scanning
      const result = await discoverReceiver({
        sessionCode: asSessionId(code),
        port: DEFAULT_PORT,
        getLocalIp,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!result) {
        setInputError(en.send.errorNotFound);
        setDiscovering(false);
        return;
      }
      setDiscovering(false);
      const addr = typeof result === "string" ? result : result.address;
      await connectToReceiver(addr as string, undefined, code);
    } catch (err) {
      if (controller.signal.aborted) return;
      setInputError(err instanceof Error ? err.message : en.send.errorDiscovery);
      setDiscovering(false);
    }
  };

  const handleCancel = () => {
    discoveryAbortRef.current?.abort();
    discoveryAbortRef.current = null;
    // stop mDNS browsing on electron
    if (isElectron && window.electronAPI?.mdnsStopBrowse) {
      window.electronAPI.mdnsStopBrowse();
    }
    session.endSession();
    setConnecting(false);
    setDiscovering(false);
    setInputError(null);
  };

  const isConnecting = session.state === SessionState.Handshaking || connecting;

  return (
    <ScreenContainer style={styles.container}>
      {/* header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (session.state !== SessionState.Closed) {
              session.endSession();
            }
            navigation.goBack();
          }}
        >
          <Text style={styles.backButtonText}>{en.common.back}</Text>
        </TouchableOpacity>
        <StatusIndicator state={session.state} />
      </View>

      {/* tab switcher */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === "scan" && styles.activeTab]}
          onPress={() => setTab("scan")}
        >
          <Text style={[styles.tabText, tab === "scan" && styles.activeTabText]}>
            {en.send.tabScan}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "code" && styles.activeTab]}
          onPress={() => setTab("code")}
        >
          <Text style={[styles.tabText, tab === "code" && styles.activeTabText]}>
            {en.send.tabCode}
          </Text>
        </TouchableOpacity>
      </View>

      {/* content */}
      <View style={styles.content}>
        {tab === "scan" && !connecting && !discovering && <QRScanner onScanned={handleQrScanned} />}

        {tab === "code" && !connecting && !discovering && (
          <View style={styles.codeForm}>
            <Text style={styles.hintText}>{en.send.hintCode}</Text>

            <TextInput
              style={styles.codeInput}
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase().slice(0, SESSION_CODE_LENGTH))}
              placeholder={CODE_PLACEHOLDER}
              placeholderTextColor={colors.textSecondary}
              maxLength={SESSION_CODE_LENGTH}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={[
                styles.connectButton,
                code.length !== SESSION_CODE_LENGTH && styles.disabledButton,
              ]}
              disabled={isConnecting || code.length !== SESSION_CODE_LENGTH}
              onPress={handleManualConnect}
            >
              <Text style={styles.connectButtonText}>{en.send.connectButton}</Text>
            </TouchableOpacity>
          </View>
        )}

        {discovering && (
          <>
            <Text style={styles.statusText}>{en.send.searching}</Text>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>{en.common.cancel}</Text>
            </TouchableOpacity>
          </>
        )}

        {isConnecting && !discovering && (
          <>
            <Text style={styles.statusText}>
              {session.state === SessionState.PendingApproval
                ? en.send.waitingApproval
                : en.send.connecting}
            </Text>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>{en.common.cancel}</Text>
            </TouchableOpacity>
          </>
        )}

        {inputError && <Text style={styles.errorText}>{inputError}</Text>}
        {session.error && <Text style={styles.errorText}>{session.error}</Text>}
        {session.state === SessionState.Rejected && (
          <Text style={styles.errorText}>{en.send.errorRejected}</Text>
        )}
      </View>
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
