import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { strings } from "../lib/core";
import { colors } from "../styles/theme";

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList, "Home">;
}

export function HomeScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{strings.APP_TITLE}</Text>
        <Text style={styles.subtitle}>
          {strings.APP_DESCRIPTION}
        </Text>

        <View style={styles.buttons}>
          <TouchableOpacity
            style={styles.receiveButton}
            activeOpacity={0.8}
            onPress={() => navigation.navigate("Receive")}
          >
            <Text style={styles.receiveButtonText}>{strings.BTN_RECEIVE}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sendButton}
            activeOpacity={0.8}
            onPress={() => navigation.navigate("Send")}
          >
            <Text style={styles.sendButtonText}>{strings.BTN_SEND}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 320,
  },
  buttons: {
    width: "100%",
    maxWidth: 320,
    marginTop: 32,
    gap: 16,
  },
  receiveButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  receiveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  sendButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
  },
});
