/**
 * platform-adaptive network adapter.
 * resolves the local LAN IP address for subnet discovery fallback.
 */

import { log } from "../lib/core";
import { isElectron, isMobile } from "../platform";

export async function getLocalIp(): Promise<string | null> {
  // electron: IPC to main process
  if (isElectron && window.electronAPI) {
    try {
      return await window.electronAPI.getLocalIp();
    } catch (err) {
      log.warn("[network] electron getLocalIp failed:", err);
      return null;
    }
  }

  // react native: react-native-network-info
  if (isMobile) {
    try {
      const { NetworkInfo } = require("react-native-network-info");
      const ip: string | null = await NetworkInfo.getIPV4Address();
      return ip && ip !== "0.0.0.0" ? ip : null;
    } catch (err) {
      log.warn("[network] RN NetworkInfo failed:", err);
      return null;
    }
  }

  return null;
}
