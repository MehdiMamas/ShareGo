/**
 * platform-adaptive clipboard adapter.
 * - electron: uses IPC to main process native clipboard
 * - react native: uses @react-native-clipboard/clipboard
 * - web: uses navigator.clipboard with execCommand fallback
 */

import { log } from "../lib/core";
import { isElectron, isMobile } from "../platform";

export async function copyToClipboard(text: string): Promise<void> {
  // electron: native clipboard via IPC
  if (isElectron && window.electronAPI?.copyToClipboard) {
    window.electronAPI.copyToClipboard(text);
    return;
  }

  // react native: @react-native-clipboard/clipboard
  if (isMobile) {
    try {
      // dynamic require to keep it out of the web/electron bundle
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const RNClipboard = require("@react-native-clipboard/clipboard").default;
      RNClipboard.setString(text);
    } catch (err) {
      log.warn("[clipboard] RN clipboard failed:", err);
    }
    return;
  }

  // web: navigator.clipboard API
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (err) {
      log.warn("[clipboard] navigator.clipboard failed, using fallback:", err);
    }
  }

  // fallback: temporary textarea + execCommand
  if (typeof document !== "undefined") {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
    } catch (err) {
      log.warn("[clipboard] execCommand('copy') failed:", err);
    }
    document.body.removeChild(textarea);
  }
}
