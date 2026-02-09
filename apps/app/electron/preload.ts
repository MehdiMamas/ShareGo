/**
 * Electron preload script.
 * exposes a safe IPC bridge to the renderer process via contextBridge.
 */

import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  // clipboard (uses electron's native clipboard — works without user gesture)
  copyToClipboard: (text: string): void => ipcRenderer.send("clipboard:copy", text),

  // ws server control
  startWsServer: (port: number): Promise<string> => ipcRenderer.invoke("ws:start", port),
  stopWsServer: (): Promise<void> => ipcRenderer.invoke("ws:stop"),
  wsSend: (data: string): Promise<void> => ipcRenderer.invoke("ws:send", data),

  // network
  getLocalIp: (): Promise<string> => ipcRenderer.invoke("net:get-local-ip"),

  // mdns discovery
  mdnsBrowse: (
    serviceType: string,
    sessionCode: string,
    timeoutMs: number,
  ): Promise<{ address: string; sessionId: string; publicKey: string | null } | null> =>
    ipcRenderer.invoke("mdns:browse", serviceType, sessionCode, timeoutMs),
  mdnsStopBrowse: (): void => ipcRenderer.send("mdns:stop-browse"),

  // mdns advertising (receiver side)
  mdnsAdvertise: (serviceType: string, port: number, meta: Record<string, string>): Promise<void> =>
    ipcRenderer.invoke("mdns:advertise", serviceType, port, meta),
  mdnsStopAdvertise: (): void => ipcRenderer.send("mdns:stop-advertise"),

  // ws events (from main -> renderer)
  onWsConnection: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on("ws:connection", handler);
    return () => ipcRenderer.removeListener("ws:connection", handler);
  },
  onWsMessage: (cb: (data: string) => void) => {
    const handler = (_event: unknown, data: string) => cb(data);
    ipcRenderer.on("ws:message", handler);
    return () => ipcRenderer.removeListener("ws:message", handler);
  },
  onWsClose: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on("ws:close", handler);
    return () => ipcRenderer.removeListener("ws:close", handler);
  },
});
