/**
 * websocket server adapter for Electron.
 * communicates with the main process WS server via IPC (window.electronAPI).
 */

import type {
  WebSocketServerAdapter,
  WebSocketClientAdapter,
  ConnectionHandler,
} from "../lib/core";
import { log } from "../lib/core";

function getElectronAPI(): NonNullable<typeof window.electronAPI> {
  if (!window.electronAPI) {
    throw new Error("electronAPI not available — is this running inside Electron?");
  }
  return window.electronAPI;
}

/**
 * wraps a single peer connection exposed via Electron IPC.
 */
class ElectronWsClient implements WebSocketClientAdapter {
  private messageHandler: ((data: Uint8Array) => void) | null = null;
  private closeHandler: (() => void) | null = null;
  private unsubMessage: (() => void) | null = null;
  private unsubClose: (() => void) | null = null;

  constructor() {
    const api = getElectronAPI();

    this.unsubMessage = api.onWsMessage((base64: string) => {
      if (this.messageHandler) {
        // decode base64 from IPC back to binary
        const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        this.messageHandler(binary);
      }
    });

    this.unsubClose = api.onWsClose(() => {
      if (this.closeHandler) this.closeHandler();
    });
  }

  async connect(_url: string): Promise<void> {
    // not used for server-side client
  }

  send(data: Uint8Array): void {
    // encode binary to base64 for IPC transport
    let binary = "";
    for (let i = 0; i < data.length; i++) {
      binary += String.fromCharCode(data[i]);
    }
    const base64 = btoa(binary);
    // catch IPC rejection if peer disconnected between send calls
    getElectronAPI()
      .wsSend(base64)
      .catch((err: unknown) => {
        log.warn("[electron-ws] send failed:", err);
      });
  }

  onMessage(handler: (data: Uint8Array) => void): void {
    this.messageHandler = handler;
  }

  onClose(handler: () => void): void {
    this.closeHandler = handler;
  }

  close(): void {
    this.unsubMessage?.();
    this.unsubClose?.();
    this.messageHandler = null;
    this.closeHandler = null;
  }
}

/**
 * electron websocket server adapter.
 * delegates to the main process via IPC for actual networking.
 */
export class ElectronWsServerAdapter implements WebSocketServerAdapter {
  private connectionHandler: ConnectionHandler | null = null;
  private unsubConnection: (() => void) | null = null;
  // buffer connection events that arrive before onConnection() is called
  private pendingClients: ElectronWsClient[] = [];

  async start(port: number): Promise<string> {
    const api = getElectronAPI();

    // subscribe to connection events BEFORE starting the server to avoid
    // race where a peer connects before the handler is registered
    this.unsubConnection = api.onWsConnection(() => {
      const client = new ElectronWsClient();
      if (this.connectionHandler) {
        this.connectionHandler(client);
      } else {
        this.pendingClients.push(client);
      }
    });

    const address = await api.startWsServer(port);
    return address;
  }

  onConnection(handler: ConnectionHandler): void {
    this.connectionHandler = handler;
    // flush any connections that arrived before the handler was set
    while (this.pendingClients.length > 0) {
      const client = this.pendingClients.shift()!;
      handler(client);
    }
  }

  async stop(): Promise<void> {
    this.unsubConnection?.();
    this.unsubConnection = null;
    this.connectionHandler = null;
    await getElectronAPI().stopWsServer();
  }
}
