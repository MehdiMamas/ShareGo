import { useState, useCallback, useEffect, useRef } from "react";
import {
  Session,
  SessionState,
  SessionRole,
  SessionEvent,
  type SessionConfig,
  type PairingRequest,
  type ILocalTransport,
  type QrPayload,
  PROTOCOL_VERSION,
  encodeQrPayload,
} from "../lib/core";

export interface ReceivedItem {
  id: number;
  text: string;
  timestamp: number;
}

export interface SentItem {
  seq: number;
  text: string;
  acked: boolean;
  timestamp: number;
}

export interface UseSessionReturn {
  state: SessionState;
  sessionId: string | null;
  qrPayload: string | null;
  pairingRequest: PairingRequest | null;
  receivedItems: ReceivedItem[];
  sentItems: SentItem[];
  error: string | null;
  startReceiver: (
    transport: ILocalTransport,
    config: SessionConfig,
  ) => Promise<void>;
  startSender: (
    transport: ILocalTransport,
    config: SessionConfig,
    addr: string,
    receiverPk?: string,
    sessionId?: string,
  ) => Promise<void>;
  approve: () => void;
  reject: (reason?: string) => void;
  sendData: (text: string) => void;
  endSession: () => void;
}

export function useSession(): UseSessionReturn {
  const sessionRef = useRef<Session | null>(null);
  const [state, setState] = useState<SessionState>(SessionState.Created);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [pairingRequest, setPairingRequest] =
    useState<PairingRequest | null>(null);
  const [receivedItems, setReceivedItems] = useState<ReceivedItem[]>([]);
  const [sentItems, setSentItems] = useState<SentItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const cleanup = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    setQrPayload(null);
    setPairingRequest(null);
    setReceivedItems([]);
    setSentItems([]);
    setError(null);
  }, []);

  const attachListeners = useCallback((session: Session) => {
    session.on(SessionEvent.StateChanged, (newState: SessionState) => {
      setState(newState);
    });

    session.on(SessionEvent.PairingRequest, (request: PairingRequest) => {
      setPairingRequest(request);
    });

    session.on(SessionEvent.DataReceived, (plaintext: Uint8Array) => {
      const text = new TextDecoder().decode(plaintext);
      setReceivedItems((prev) => [
        ...prev,
        { id: Date.now(), text, timestamp: Date.now() },
      ]);
    });

    session.on(SessionEvent.DataAcknowledged, (seq: number) => {
      setSentItems((prev) =>
        prev.map((item) =>
          item.seq === seq ? { ...item, acked: true } : item,
        ),
      );
    });

    session.on(SessionEvent.Error, (err: Error) => {
      setError(err.message);
    });
  }, []);

  const startReceiver = useCallback(
    async (transport: ILocalTransport, config: SessionConfig) => {
      cleanup();
      const session = new Session(SessionRole.Receiver, config);
      sessionRef.current = session;
      setSessionId(session.id);
      setState(SessionState.Created);
      attachListeners(session);

      await session.startAsReceiver(transport);

      // build QR payload after transport is bound
      const addr = transport.getLocalAddress();
      if (addr) {
        const payload: QrPayload = {
          v: PROTOCOL_VERSION,
          sid: session.id,
          addr,
          pk: session.getPublicKey()!,
          exp: session.getBootstrapTtl(),
        };
        setQrPayload(encodeQrPayload(payload));
      }
    },
    [cleanup, attachListeners],
  );

  const startSender = useCallback(
    async (
      transport: ILocalTransport,
      config: SessionConfig,
      addr: string,
      receiverPk?: string,
      sid?: string,
    ) => {
      cleanup();
      const session = new Session(SessionRole.Sender, config, sid);
      sessionRef.current = session;
      setSessionId(session.id);
      setState(SessionState.Created);
      attachListeners(session);

      await session.startAsSender(transport, addr, receiverPk);
    },
    [cleanup, attachListeners],
  );

  const approve = useCallback(() => {
    sessionRef.current?.approvePairing();
    setPairingRequest(null);
  }, []);

  const reject = useCallback((reason?: string) => {
    sessionRef.current?.rejectPairing(reason);
    setPairingRequest(null);
  }, []);

  const sendData = useCallback((text: string) => {
    if (!sessionRef.current) return;
    const bytes = new TextEncoder().encode(text);
    const seq = sessionRef.current.sendData(bytes);
    setSentItems((prev) => [
      ...prev,
      { seq, text, acked: false, timestamp: Date.now() },
    ]);
  }, []);

  const endSession = useCallback(() => {
    cleanup();
    setState(SessionState.Closed);
    setSessionId(null);
  }, [cleanup]);

  useEffect(() => {
    return () => {
      sessionRef.current?.close();
    };
  }, []);

  return {
    state,
    sessionId,
    qrPayload,
    pairingRequest,
    receivedItems,
    sentItems,
    error,
    startReceiver,
    startSender,
    approve,
    reject,
    sendData,
    endSession,
  };
}
