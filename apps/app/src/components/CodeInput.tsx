import React from "react";
import { TextInput, StyleSheet } from "react-native";
import { colors } from "../styles/theme";
import { CODE_PLACEHOLDER, SESSION_CODE_LENGTH } from "../lib/core";

interface CodeInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function CodeInput({ value, onChange }: CodeInputProps) {
  return (
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={(text) => onChange(text.toUpperCase().slice(0, SESSION_CODE_LENGTH))}
      placeholder={CODE_PLACEHOLDER}
      placeholderTextColor={colors.textSecondary}
      maxLength={SESSION_CODE_LENGTH}
      autoCapitalize="characters"
      autoCorrect={false}
    />
  );
}

const styles = StyleSheet.create({
  input: {
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
});
