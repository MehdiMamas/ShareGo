import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  WebSocketServerAdapter,
  WebSocketClientAdapter,
  ConnectionHandler,
} from "../lib/core";

function toBase64(data: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * wraps the tauri ws server's client connection.
 * messages arrive via tauri events and are sent via tauri commands.
 */
class TauriWsClient implements WebSocketClientAdapter {
  private messageHandler: ((data: Uint8Array) => void) | null = null;
  private closeHandler: (() => void) | null = null;
  private unlistenMessage: UnlistenFn | null = null;
  private unlistenClose: UnlistenFn | null = null;

  async setup(): Promise<void> {
    this.unlistenMessage = await listen<{ data: string }>(
      "ws-message",
      (event) => {
        if (this.messageHandler) {
          const bytes = fromBase64(event.payload.data);
          this.messageHandler(bytes);
        }
      },
    );

    this.unlistenClose = await listen("ws-close", () => {
      if (this.closeHandler) {
        this.closeHandler();
      }
    });
  }

  async connect(_url: string): Promise<void> {
    // not used for server-side client
  }

  send(data: Uint8Array): void {
    const b64 = toBase64(data);
    invoke("ws_send", { data: b64 }).catch((err) => {
      console.error("ws_send failed:", err);
    });
  }

  onMessage(handler: (data: Uint8Array) => void): void {
    this.messageHandler = handler;
  }

  onClose(handler: () => void): void {
    this.closeHandler = handler;
  }

  close(): void {
    this.unlistenMessage?.();
    this.unlistenClose?.();
    this.messageHandler = null;
    this.closeHandler = null;
  }
}

/**
 * tauri websocket server adapter.
 * delegates to the rust ws_server via tauri commands.
 */
export class TauriWsServerAdapter implements WebSocketServerAdapter {
  private connectionHandler: ConnectionHandler | null = null;
  private unlistenConnection: UnlistenFn | null = null;
  private client: TauriWsClient | null = null;

  async start(port: number): Promise<string> {
    this.client = new TauriWsClient();
    await this.client.setup();

    this.unlistenConnection = await listen("ws-connection", () => {
      if (this.connectionHandler && this.client) {
        this.connectionHandler(this.client);
      }
    });

    const addr: string = await invoke("start_ws_server", { port });
    return addr;
  }

  onConnection(handler: ConnectionHandler): void {
    this.connectionHandler = handler;
  }

  async stop(): Promise<void> {
    this.unlistenConnection?.();
    this.client?.close();
    this.client = null;
    await invoke("stop_ws_server");
  }
}
