import React, { useContext, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Clipboard from "@react-native-clipboard/clipboard";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { SessionContext } from "../App";
import { SessionState, COPY_FEEDBACK_MS, strings } from "../lib/core";
import { StatusIndicator } from "../components/StatusIndicator";
import { colors } from "../styles/theme";
import type { ReceivedItem, SentItem } from "../hooks/useSession";

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList, "ActiveSession">;
}

type ListItem =
  | { type: "sent"; data: SentItem }
  | { type: "received"; data: ReceivedItem };

export function ActiveSessionScreen({ navigation }: Props) {
  const ctx = useContext(SessionContext)!;
  const { session } = ctx;
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState<number | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  // navigate home when session closes
  useEffect(() => {
    if (session.state === SessionState.Closed) {
      navigation.reset({ index: 0, routes: [{ name: "Home" }] });
    }
  }, [session.state, navigation]);

  const handleSend = () => {
    if (!input.trim()) return;
    session.sendData(input.trim());
    setInput("");
  };

  const handleCopy = (text: string, id: number) => {
    Clipboard.setString(text);
    setCopied(id);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(null), COPY_FEEDBACK_MS);
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
      return (
        <View style={styles.sentBubble}>
          <Text style={styles.messageText}>{sent.text}</Text>
          <Text style={styles.sentStatus}>
            {sent.acked ? strings.STATUS_DELIVERED : strings.STATUS_SENDING}
          </Text>
        </View>
      );
    }

    const received = item.data as ReceivedItem;
    return (
      <View style={styles.receivedBubble}>
        <Text style={styles.messageText}>{received.text}</Text>
        <TouchableOpacity
          style={[
            styles.copyButton,
            copied === received.id && styles.copiedButton,
          ]}
          onPress={() => handleCopy(received.text, received.id)}
        >
          <Text style={styles.copyButtonText}>
            {copied === received.id ? strings.BTN_COPIED : strings.BTN_COPY}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.sessionTitle}>
            session {session.sessionId}
          </Text>
          <StatusIndicator state={session.state} />
        </View>
        <TouchableOpacity
          style={styles.endButton}
          onPress={() => session.endSession()}
        >
          <Text style={styles.endButtonText}>{strings.BTN_END_SESSION}</Text>
        </TouchableOpacity>
      </View>

      {/* messages */}
      <FlatList
        style={styles.messageList}
        data={items}
        keyExtractor={(item, index) =>
          item.type === "sent"
            ? `sent-${(item.data as SentItem).seq}`
            : `recv-${(item.data as ReceivedItem).id}-${index}`
        }
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{strings.EMPTY_MESSAGES}</Text>
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
          placeholder={strings.INPUT_PLACEHOLDER}
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
          <Text style={styles.sendButtonText}>{strings.BTN_SEND_DATA}</Text>
        </TouchableOpacity>
      </View>

      {session.error && (
        <Text style={styles.errorText}>{session.error}</Text>
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
  sentStatus: {
    fontSize: 11,
    color: colors.sentStatusText,
    marginTop: 4,
    textAlign: "right",
  },
  copyButton: {
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: colors.border,
    alignSelf: "flex-start",
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
