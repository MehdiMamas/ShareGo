/**
 * platform-aware screen container.
 * on mobile: uses SafeAreaView for notch/home indicator insets.
 * on Electron/web: uses a div with 100vh height so layout doesn't depend
 *   on the react-native-web flex chain through navigation layers.
 */
import React from "react";
import { View, StyleSheet, Platform, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { isElectron } from "../platform";

interface Props {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

// macOS traffic lights sit at y=16 and are ~16px tall
const TITLE_BAR_HEIGHT = 48;

export function ScreenContainer({ style, children }: Props) {
  if (Platform.OS !== "web") {
    return <SafeAreaView style={[styles.base, style]}>{children}</SafeAreaView>;
  }

  // on web/electron, use 100vh to guarantee full viewport fill
  return (
    <View
      style={[
        styles.base,
        styles.webContainer,
        isElectron && styles.electronPadding,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
  },
  webContainer: {
    // @ts-expect-error -- 100vh is valid CSS but not in RN types
    height: "100vh",
    // @ts-expect-error
    minHeight: "100vh",
  },
  electronPadding: {
    paddingTop: TITLE_BAR_HEIGHT,
  },
});
