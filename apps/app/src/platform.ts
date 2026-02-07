/**
 * platform detection for the unified app.
 * determines which adapters and components to use at runtime.
 */

import { Platform } from "react-native";

/** true when running inside Electron's renderer process */
export const isElectron =
  typeof window !== "undefined" && window.electronAPI !== undefined;

/** true when running on iOS or Android */
export const isMobile = Platform.OS === "ios" || Platform.OS === "android";

/** true when running in a plain browser (no Electron, no native) */
export const isWeb = Platform.OS === "web" && !isElectron;
