/**
 * web stub for the react native ws client adapter.
 * this file is resolved by Vite (.web.ts) instead of the real RN adapter.
 * on web/Electron, WebWsClientAdapter is used instead.
 */
import type { WebSocketClientAdapter } from "../lib/core";

export class RnWsClientAdapter implements WebSocketClientAdapter {
  connect(_url: string): Promise<void> {
    throw new Error("RnWsClientAdapter is not available on web");
  }
  send(_data: Uint8Array): void {
    throw new Error("RnWsClientAdapter is not available on web");
  }
  onMessage(_handler: (data: Uint8Array) => void): void {
    throw new Error("RnWsClientAdapter is not available on web");
  }
  onClose(_handler: () => void): void {
    throw new Error("RnWsClientAdapter is not available on web");
  }
  close(): Promise<void> {
    return Promise.resolve();
  }
}
