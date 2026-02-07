import { useCallback, useEffect, useRef } from "react";
import { WebSocketTransport } from "../lib/core";
import { TauriWsServerAdapter } from "../adapters/tauri-ws-server";
import { BrowserWsClientAdapter } from "../adapters/browser-ws-client";

export function useTransport() {
  const transportRef = useRef<WebSocketTransport | null>(null);

  const cleanupPrevious = useCallback(() => {
    if (transportRef.current) {
      transportRef.current.close();
      transportRef.current = null;
    }
  }, []);

  const createReceiverTransport = useCallback(() => {
    cleanupPrevious();
    const transport = new WebSocketTransport(
      () => new TauriWsServerAdapter(),
      undefined,
    );
    transportRef.current = transport;
    return transport;
  }, [cleanupPrevious]);

  const createSenderTransport = useCallback(() => {
    cleanupPrevious();
    const transport = new WebSocketTransport(
      undefined,
      () => new BrowserWsClientAdapter(),
    );
    transportRef.current = transport;
    return transport;
  }, [cleanupPrevious]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      transportRef.current?.close();
      transportRef.current = null;
    };
  }, []);

  return { createReceiverTransport, createSenderTransport };
}
