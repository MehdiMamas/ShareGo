import { useCallback, useEffect, useRef } from "react";
import { WebSocketTransport } from "../lib/core";
import { isElectron, isMobile } from "../platform";
import { ElectronWsServerAdapter } from "../adapters/electron-ws-server";
import { WebWsClientAdapter } from "../adapters/web-ws-client";
import { RnWsServerAdapter } from "../adapters/rn-ws-server";
import { RnWsClientAdapter } from "../adapters/rn-ws-client";

/**
 * platform-aware transport hook.
 * returns the correct adapter factories based on the current platform:
 * - Electron: ElectronWsServerAdapter + WebWsClientAdapter
 * - Mobile: RnWsServerAdapter + RnWsClientAdapter
 * - Web: no server (web browsers can't listen), WebWsClientAdapter only
 */
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

    let serverFactory: (() => any) | undefined;

    if (isElectron) {
      serverFactory = () => new ElectronWsServerAdapter();
    } else if (isMobile) {
      serverFactory = () => new RnWsServerAdapter();
    }

    const transport = new WebSocketTransport(serverFactory, undefined);
    transportRef.current = transport;
    return transport;
  }, [cleanupPrevious]);

  const createSenderTransport = useCallback(() => {
    cleanupPrevious();

    let clientFactory: (() => any) | undefined;

    if (isMobile) {
      clientFactory = () => new RnWsClientAdapter();
    } else {
      // both Electron and web use the browser WebSocket API
      clientFactory = () => new WebWsClientAdapter();
    }

    const transport = new WebSocketTransport(undefined, clientFactory);
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
