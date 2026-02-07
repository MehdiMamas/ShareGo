import { useCallback, useEffect, useRef } from "react";
import { WebSocketTransport } from "../lib/core";
import { isElectron, isMobile } from "../platform";

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
      // lazy import to avoid bundling electron adapter on mobile
      const { ElectronWsServerAdapter } = require("../adapters/electron-ws-server");
      serverFactory = () => new ElectronWsServerAdapter();
    } else if (isMobile) {
      // lazy import to avoid bundling RN TCP on web/electron
      const { RnWsServerAdapter } = require("../adapters/rn-ws-server");
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
      const { RnWsClientAdapter } = require("../adapters/rn-ws-client");
      clientFactory = () => new RnWsClientAdapter();
    } else {
      // both Electron and web use the browser WebSocket API
      const { WebWsClientAdapter } = require("../adapters/web-ws-client");
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
