/**
 * type declarations for the Electron preload API.
 * the renderer process accesses these via window.electronAPI.
 */
export interface ElectronAPI {
  copyToClipboard(text: string): void;
  startWsServer(port: number): Promise<string>;
  stopWsServer(): Promise<void>;
  wsSend(data: string): Promise<void>;
  getLocalIp(): Promise<string>;
  mdnsBrowse(
    serviceType: string,
    sessionCode: string,
    timeoutMs: number,
  ): Promise<{ address: string; sessionId: string; publicKey: string | null } | null>;
  mdnsStopBrowse(): void;
  mdnsAdvertise(serviceType: string, port: number, meta: Record<string, string>): Promise<void>;
  mdnsStopAdvertise(): void;
  onWsConnection(cb: () => void): () => void;
  onWsMessage(cb: (data: string) => void): () => void;
  onWsClose(cb: () => void): () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
