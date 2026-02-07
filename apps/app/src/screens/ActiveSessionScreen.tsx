import React, { useContext, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from "react-native";
import { ScreenContainer } from "../components/ScreenContainer";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { SessionContext } from "../App";
import { SessionState, COPY_FEEDBACK_MS, en } from "../lib/core";
import { StatusIndicator } from "../components/StatusIndicator";
import { EyeIcon, EyeOffIcon } from "../components/Icons";
import { colors } from "../styles/theme";
import { isElectron } from "../platform";
import type { ReceivedItem, SentItem } from "../hooks/useSession";

const MASKED_TEXT = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList, "ActiveSession">;
}

type ListItem =
  | { type: "sent"; data: SentItem }
  | { type: "received"; data: ReceivedItem };

/** copy text to clipboard (cross-platform) */
function copyToClipboard(text: string): void {
  // electron: use native clipboard via IPC (works without user gesture)
  if (isElectron && window.electronAPI?.copyToClipboard) {
    window.electronAPI.copyToClipboard(text);
    return;
  }

  // react native: use @react-native-clipboard/clipboard
  if (Platform.OS !== "web") {
    try {
      // dynamic require so web/electron bundles don't try to resolve this
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const RNClipboard = require("@react-native-clipboard/clipboard").default;
      RNClipboard.setString(text);
    } catch {
      // best effort
    }
    return;
  }

  // web: modern clipboard API
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {
      fallbackCopy(text);
    });
    return;
  }
  fallbackCopy(text);
}

/** fallback copy using a temporary textarea (web only) */
function fallbackCopy(text: string): void {
  if (typeof document === "undefined") return;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand("copy");
  } catch {
    // best effort
  }
  document.body.removeChild(textarea);
}

export function ActiveSessionScreen({ navigation }: Props) {
  const ctx = useContext(SessionContext)!;
  const { session } = ctx;
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState<number | null>(null);
  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set());
  const [autoCopy, setAutoCopy] = useState(true);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const flatListRef = useRef<FlatList>(null);
  const prevReceivedCountRef = useRef(session.receivedItems.length);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  // auto-copy latest received item to clipboard
  useEffect(() => {
    if (autoCopy && session.receivedItems.length > prevReceivedCountRef.current) {
      const latest = session.receivedItems[session.receivedItems.length - 1];
      if (latest) {
        copyToClipboard(latest.text);
        setCopied(latest.id);
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(() => setCopied(null), COPY_FEEDBACK_MS);
      }
    }
    prevReceivedCountRef.current = session.receivedItems.length;
  }, [session.receivedItems.length, autoCopy]);

  // navigate home when session closes
  useEffect(() => {
    if (session.state === SessionState.Closed) {
      navigation.reset({ index: 0, routes: [{ name: "Home" }] });
    }
  }, [session.state, navigation]);

  // auto-scroll to latest message
  const itemCount = session.sentItems.length + session.receivedItems.length;
  useEffect(() => {
    if (itemCount > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [itemCount]);

  const handleSend = () => {
    if (!input.trim()) return;
    session.sendData(input.trim());
    setInput("");
  };

  const handleCopy = (text: string, id: number) => {
    copyToClipboard(text);
    setCopied(id);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(null), COPY_FEEDBACK_MS);
  };

  const toggleVisibility = (key: string) => {
    setVisibleItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const items: ListItem[] = [
    ...session.sentItems.map(
      (s): ListItem => ({ type: "sent", data: s }),
    ),
    ...session.receivedItems.map(
      (r): ListItem => ({ type: "received", data: r }),
    ),
  ].sort((a, b) => {
    const timeA =
      a.type === "sent"
        ? (a.data as SentItem).timestamp
        : (a.data as ReceivedItem).timestamp;
    const timeB =
      b.type === "sent"
        ? (b.data as SentItem).timestamp
        : (b.data as ReceivedItem).timestamp;
    return timeA - timeB;
  });

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === "sent") {
      const sent = item.data as SentItem;
      const key = `sent-${sent.seq}`;
      const isVisible = visibleItems.has(key);
      return (
        <View style={styles.sentBubble}>
          <Text style={styles.messageText}>
            {isVisible ? sent.text : MASKED_TEXT}
          </Text>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => toggleVisibility(key)}
            >
              {isVisible ? (
                <EyeOffIcon size={16} color={colors.sentStatusText} />
              ) : (
                <EyeIcon size={16} color={colors.sentStatusText} />
              )}
            </TouchableOpacity>
            <Text style={styles.sentStatus}>
              {sent.acked ? en.session.delivered : en.session.sending}
            </Text>
          </View>
        </View>
      );
    }

    const received = item.data as ReceivedItem;
    const key = `recv-${received.id}`;
    const isVisible = visibleItems.has(key);
    return (
      <View style={styles.receivedBubble}>
        <Text style={styles.messageText}>
          {isVisible ? received.text : MASKED_TEXT}
        </Text>
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => toggleVisibility(key)}
          >
            {isVisible ? (
              <EyeOffIcon size={16} color={colors.textSecondary} />
            ) : (
              <EyeIcon size={16} color={colors.textSecondary} />
            )}
          </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.copyButton,
                copied === received.id && styles.copiedButton,
              ]}
              onPress={() => handleCopy(received.text, received.id)}
            >
              <Text style={styles.copyButtonText}>
                {copied === received.id ? en.session.copied : en.session.copy}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.sessionTitle}>
              session {session.sessionId}
            </Text>
            <StatusIndicator state={session.state} />
          </View>
          <View style={styles.headerActions}>
            <View style={styles.autoCopyRow}>
              <Text style={styles.autoCopyLabel}>{en.session.autoCopy}</Text>
              <Switch
                value={autoCopy}
                onValueChange={setAutoCopy}
                trackColor={{ false: colors.border, true: colors.success }}
                thumbColor={colors.white}
              />
            </View>
            <TouchableOpacity
              style={styles.endButton}
              onPress={() => session.endSession()}
            >
              <Text style={styles.endButtonText}>{en.session.endSession}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* messages */}
        <FlatList
          ref={flatListRef}
          style={styles.messageList}
          data={items}
          keyExtractor={(item, index) =>
            item.type === "sent"
              ? `sent-${(item.data as SentItem).seq}`
              : `recv-${(item.data as ReceivedItem).id}-${index}`
          }
          renderItem={renderItem}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{en.session.emptyHint}</Text>
            </View>
          }
          contentContainerStyle={
            items.length === 0 ? styles.emptyList : undefined
          }
        />

        {/* input */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder={en.session.inputPlaceholder}
            placeholderTextColor={colors.textSecondary}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              !input.trim() && styles.disabledSend,
            ]}
            disabled={!input.trim()}
            onPress={handleSend}
          >
            <Text style={styles.sendButtonText}>{en.session.sendButton}</Text>
          </TouchableOpacity>
        </View>

        {session.error && (
          <Text style={styles.errorText}>{session.error}</Text>
        )}
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  autoCopyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  autoCopyLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  endButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.error,
  },
  endButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.white,
  },
  messageList: {
    flex: 1,
  },
  emptyList: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  sentBubble: {
    alignSelf: "flex-end",
    maxWidth: "80%",
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.primary,
    marginBottom: 8,
  },
  receivedBubble: {
    alignSelf: "flex-start",
    maxWidth: "80%",
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  messageText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 8,
  },
  eyeButton: {
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  sentStatus: {
    fontSize: 11,
    color: colors.sentStatusText,
    marginLeft: "auto",
  },
  copyButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: colors.border,
    marginLeft: "auto",
  },
  copiedButton: {
    backgroundColor: colors.success,
  },
  copyButtonText: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.textPrimary,
  },
  inputRow: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  textInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: "center",
  },
  disabledSend: {
    backgroundColor: colors.border,
  },
  sendButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  errorText: {
    fontSize: 13,
    color: colors.error,
    marginTop: 8,
    textAlign: "center",
  },
});
