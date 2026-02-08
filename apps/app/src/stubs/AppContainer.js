/**
 * stub for react-native AppContainer.
 * on web, renders children directly.
 */
import React from "react";
import { View } from "react-native-web";

export default function AppContainer({ children }) {
  return React.createElement(View, { style: { flex: 1 } }, children);
}
