import { useCallback, useEffect, useRef } from "react";
import { WebSocketTransport } from "../lib/core";
import { RnWsServerAdapter } from "../adapters/rn-ws-server";
import { RnWsClientAdapter } from "../adapters/rn-ws-client";

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
      () => new RnWsServerAdapter(),
      undefined,
    );
    transportRef.current = transport;
    return transport;
  }, [cleanupPrevious]);

  const createSenderTransport = useCallback(() => {
    cleanupPrevious();
    const transport = new WebSocketTransport(
      undefined,
      () => new RnWsClientAdapter(),
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
