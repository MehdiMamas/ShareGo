import { useCallback, useRef } from "react";
import { WebSocketTransport } from "../lib/core";
import { RnWsServerAdapter } from "../adapters/rn-ws-server";
import { RnWsClientAdapter } from "../adapters/rn-ws-client";

export function useTransport() {
  const transportRef = useRef<WebSocketTransport | null>(null);

  const createReceiverTransport = useCallback(() => {
    const transport = new WebSocketTransport(
      () => new RnWsServerAdapter(),
      undefined,
    );
    transportRef.current = transport;
    return transport;
  }, []);

  const createSenderTransport = useCallback(() => {
    const transport = new WebSocketTransport(
      undefined,
      () => new RnWsClientAdapter(),
    );
    transportRef.current = transport;
    return transport;
  }, []);

  return { createReceiverTransport, createSenderTransport };
}
