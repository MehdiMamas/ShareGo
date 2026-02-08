/**
 * web stub for the react native ws server adapter.
 * this file is resolved by Vite (.web.ts) instead of the real RN adapter,
 * which depends on native modules unavailable in the browser.
 */
import type { WebSocketServerAdapter, ConnectionHandler } from "../lib/core";

export class RnWsServerAdapter implements WebSocketServerAdapter {
  start(_port: number, _handler: ConnectionHandler): Promise<string> {
    throw new Error("RnWsServerAdapter is not available on web");
  }
  send(_data: Uint8Array): void {
    throw new Error("RnWsServerAdapter is not available on web");
  }
  stop(): Promise<void> {
    return Promise.resolve();
  }
}
