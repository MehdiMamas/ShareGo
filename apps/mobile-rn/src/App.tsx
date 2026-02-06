import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { initCrypto } from "./lib/core";
import { useSession } from "./hooks/useSession";
import { useTransport } from "./hooks/useTransport";
import { HomeScreen } from "./screens/HomeScreen";
import { ReceiveScreen } from "./screens/ReceiveScreen";
import { SendScreen } from "./screens/SendScreen";
import { ActiveSessionScreen } from "./screens/ActiveSessionScreen";
import { colors } from "./styles/theme";

export type RootStackParamList = {
  Home: undefined;
  Receive: undefined;
  Send: undefined;
  ActiveSession: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// shared context for session and transport across screens
export const SessionContext = React.createContext<{
  session: ReturnType<typeof useSession>;
  transport: ReturnType<typeof useTransport>;
} | null>(null);

export default function App() {
  const [ready, setReady] = useState(false);
  const session = useSession();
  const transport = useTransport();

  useEffect(() => {
    initCrypto().then(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <SessionContext.Provider value={{ session, transport }}>
        <NavigationContainer
          theme={{
            dark: true,
            colors: {
              primary: colors.primary,
              background: colors.background,
              card: colors.surface,
              text: colors.textPrimary,
              border: colors.border,
              notification: colors.primary,
            },
            fonts: {
              regular: { fontFamily: "System", fontWeight: "400" },
              medium: { fontFamily: "System", fontWeight: "500" },
              bold: { fontFamily: "System", fontWeight: "700" },
              heavy: { fontFamily: "System", fontWeight: "900" },
            },
          }}
        >
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
              animation: "slide_from_right",
            }}
          >
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Receive" component={ReceiveScreen} />
            <Stack.Screen name="Send" component={SendScreen} />
            <Stack.Screen
              name="ActiveSession"
              component={ActiveSessionScreen}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </SessionContext.Provider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
});
