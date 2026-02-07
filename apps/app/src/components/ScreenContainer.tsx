/**
 * platform-aware screen container.
 * on mobile: uses SafeAreaView for notch/home indicator insets.
 * on Electron: uses a plain View with manual padding for the hidden title bar.
 */
import React from "react";
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { isElectron } from "../platform";

interface Props {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

const TITLE_BAR_HEIGHT = 48;

export function ScreenContainer({ style, children }: Props) {
  if (isElectron) {
    return (
      <View style={[styles.electronBase, style, styles.electronPadding]}>
        {children}
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.base, style]}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
  },
  electronBase: {
    flex: 1,
    height: "100%" as any,
  },
  electronPadding: {
    paddingTop: TITLE_BAR_HEIGHT,
  },
});
