/**
 * type declarations for the Electron preload API.
 * the renderer process accesses these via window.electronAPI.
 */
export interface ElectronAPI {
  startWsServer(port: number): Promise<string>;
  stopWsServer(): Promise<void>;
  wsSend(data: string): Promise<void>;
  getLocalIp(): Promise<string>;
  onWsConnection(cb: () => void): () => void;
  onWsMessage(cb: (data: string) => void): () => void;
  onWsClose(cb: () => void): () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
