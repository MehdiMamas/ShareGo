import type { WebSocketClientAdapter } from "../lib/core";
import { WS_CONNECT_TIMEOUT_MS } from "../lib/core";

/**
 * websocket client adapter using react native's built-in WebSocket.
 * used by the sender to connect to the receiver's ws server.
 */
export class RnWsClientAdapter implements WebSocketClientAdapter {
  private ws: WebSocket | null = null;
  private messageHandler: ((data: Uint8Array) => void) | null = null;
  private closeHandler: (() => void) | null = null;

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.ws?.close();
        reject(new Error("connection timed out"));
      }, WS_CONNECT_TIMEOUT_MS);

      this.ws = new WebSocket(url);
      this.ws.binaryType = "arraybuffer";

      this.ws.onopen = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve();
      };

      this.ws.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(new Error("websocket connection failed"));
      };

      this.ws.onmessage = (event: WebSocketMessageEvent) => {
        if (this.messageHandler) {
          const data =
            event.data instanceof ArrayBuffer
              ? new Uint8Array(event.data)
              : new TextEncoder().encode(String(event.data));
          this.messageHandler(data);
        }
      };

      this.ws.onclose = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          reject(new Error("websocket closed before connection established"));
        }
        if (this.closeHandler) this.closeHandler();
      };
    });
  }

  send(data: Uint8Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("websocket not connected");
    }
    this.ws.send(data.buffer);
  }

  onMessage(handler: (data: Uint8Array) => void): void {
    this.messageHandler = handler;
  }

  onClose(handler: () => void): void {
    this.closeHandler = handler;
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
    this.messageHandler = null;
    this.closeHandler = null;
  }
}
