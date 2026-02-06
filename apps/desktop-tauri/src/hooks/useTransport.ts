import { useCallback, useRef } from "react";
import { WebSocketTransport } from "../lib/core";
import { TauriWsServerAdapter } from "../adapters/tauri-ws-server";
import { BrowserWsClientAdapter } from "../adapters/browser-ws-client";

export function useTransport() {
  const transportRef = useRef<WebSocketTransport | null>(null);

  const createReceiverTransport = useCallback(() => {
    const transport = new WebSocketTransport(
      () => new TauriWsServerAdapter(),
      undefined,
    );
    transportRef.current = transport;
    return transport;
  }, []);

  const createSenderTransport = useCallback(() => {
    const transport = new WebSocketTransport(
      undefined,
      () => new BrowserWsClientAdapter(),
    );
    transportRef.current = transport;
    return transport;
  }, []);

  return { createReceiverTransport, createSenderTransport };
}
