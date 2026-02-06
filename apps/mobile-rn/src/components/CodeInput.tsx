import React from "react";
import { TextInput, StyleSheet } from "react-native";
import { colors } from "../styles/theme";

interface CodeInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function CodeInput({ value, onChange }: CodeInputProps) {
  return (
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={(text) => onChange(text.toUpperCase().slice(0, 6))}
      placeholder="ABC123"
      placeholderTextColor={colors.textSecondary}
      maxLength={6}
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
