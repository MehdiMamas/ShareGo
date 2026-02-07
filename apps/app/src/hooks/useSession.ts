import { useState, useCallback, useEffect, useRef } from "react";
import {
  SessionController,
  SessionState,
  type SessionConfig,
  type PairingRequest,
  type ILocalTransport,
  type ReceivedItem,
  type SentItem,
  type SessionId,
} from "../lib/core";

export type { ReceivedItem, SentItem };

export interface UseSessionReturn {
  state: SessionState;
  sessionId: string | null;
  qrPayload: string | null;
  localAddress: string | null;
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
  const controllerRef = useRef<SessionController | null>(null);

  if (!controllerRef.current) {
    controllerRef.current = new SessionController();
  }
  const ctrl = controllerRef.current;

  const [state, setState] = useState<SessionState>(SessionState.Created);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [localAddress, setLocalAddress] = useState<string | null>(null);
  const [pairingRequest, setPairingRequest] =
    useState<PairingRequest | null>(null);
  const [receivedItems, setReceivedItems] = useState<ReceivedItem[]>([]);
  const [sentItems, setSentItems] = useState<SentItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // sync controller snapshot to react state
  useEffect(() => {
    const unsub = ctrl.subscribe((snap) => {
      setState(snap.state);
      setSessionId(snap.sessionId);
      setQrPayload(snap.qrPayload);
      setLocalAddress(snap.localAddress as string | null);
      setPairingRequest(snap.pairingRequest);
      setReceivedItems(snap.receivedItems);
      setSentItems(snap.sentItems);
      setError(snap.error);
    });
    return () => {
      unsub();
      ctrl.destroy();
    };
  }, [ctrl]);

  const startReceiver = useCallback(
    (transport: ILocalTransport, config: SessionConfig) =>
      ctrl.startReceiver(transport, config),
    [ctrl],
  );

  const startSender = useCallback(
    (
      transport: ILocalTransport,
      config: SessionConfig,
      addr: string,
      receiverPk?: string,
      sid?: string,
    ) => ctrl.startSender(transport, config, addr, receiverPk, sid as SessionId | undefined),
    [ctrl],
  );

  const approve = useCallback(() => ctrl.approve(), [ctrl]);
  const reject = useCallback((reason?: string) => ctrl.reject(reason), [ctrl]);
  const sendData = useCallback((text: string) => ctrl.sendData(text), [ctrl]);
  const endSession = useCallback(() => ctrl.endSession(), [ctrl]);

  return {
    state,
    sessionId,
    qrPayload,
    localAddress,
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
