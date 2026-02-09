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
