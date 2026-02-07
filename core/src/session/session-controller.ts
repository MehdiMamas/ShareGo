import { Session } from "./session.js";
import type { SessionConfig } from "./session.js";
import { SessionState, SessionRole, SessionEvent } from "./types.js";
import type { PairingRequest } from "./types.js";
import type { ILocalTransport } from "../transport/index.js";
import type { QrPayload } from "../protocol/index.js";
import { PROTOCOL_VERSION, encodeQrPayload } from "../protocol/index.js";

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

export interface SessionSnapshot {
  state: SessionState;
  sessionId: string | null;
  qrPayload: string | null;
  localAddress: string | null;
  pairingRequest: PairingRequest | null;
  receivedItems: ReceivedItem[];
  sentItems: SentItem[];
  error: string | null;
}

export type SnapshotListener = (snapshot: SessionSnapshot) => void;

let nextItemId = 1;

/**
 * framework-agnostic session controller.
 * encapsulates session lifecycle, listener management, and state tracking.
 * platform hooks (react, react native) thin-wrap this with their own state binding.
 */
export class SessionController {
  private session: Session | null = null;
  private snapshot: SessionSnapshot = {
    state: SessionState.Created,
    sessionId: null,
    qrPayload: null,
    localAddress: null,
    pairingRequest: null,
    receivedItems: [],
    sentItems: [],
    error: null,
  };
  private listeners = new Set<SnapshotListener>();

  /** subscribe to snapshot changes */
  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): SessionSnapshot {
    return this.snapshot;
  }

  private notify(): void {
    for (const cb of this.listeners) {
      try { cb(this.snapshot); } catch { /* don't crash on listener error */ }
    }
  }

  private update(partial: Partial<SessionSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...partial };
    this.notify();
  }

  private attachListeners(session: Session): void {
    session.on(SessionEvent.StateChanged, (newState: SessionState) => {
      this.update({ state: newState });
    });

    session.on(SessionEvent.PairingRequest, (request: PairingRequest) => {
      this.update({ pairingRequest: request });
    });

    session.on(SessionEvent.DataReceived, (plaintext: Uint8Array) => {
      const text = new TextDecoder().decode(plaintext);
      this.update({
        receivedItems: [
          ...this.snapshot.receivedItems,
          { id: nextItemId++, text, timestamp: Date.now() },
        ],
      });
    });

    session.on(SessionEvent.DataAcknowledged, (seq: number) => {
      this.update({
        sentItems: this.snapshot.sentItems.map((item) =>
          item.seq === seq ? { ...item, acked: true } : item,
        ),
      });
    });

    session.on(SessionEvent.Error, (err: Error) => {
      this.update({ error: err.message });
    });
  }

  cleanup(): void {
    if (this.session) {
      this.session.close();
      this.session = null;
    }
    this.update({
      state: SessionState.Closed,
      qrPayload: null,
      localAddress: null,
      pairingRequest: null,
      receivedItems: [],
      sentItems: [],
      error: null,
    });
  }

  async startReceiver(
    transport: ILocalTransport,
    config: SessionConfig,
  ): Promise<void> {
    this.cleanup();
    this.update({ error: null });

    const session = new Session(SessionRole.Receiver, config);
    this.session = session;
    this.update({ sessionId: session.id, state: SessionState.Created });
    this.attachListeners(session);

    await session.startAsReceiver(transport);

    // bail if this session was superseded by a new one during the async await
    if (this.session !== session) return;

    const addr = transport.getLocalAddress();
    if (addr) {
      const payload: QrPayload = {
        v: PROTOCOL_VERSION,
        sid: session.id,
        addr,
        pk: session.getPublicKey()!,
        exp: session.getBootstrapTtl(),
      };
      this.update({
        localAddress: addr,
        qrPayload: encodeQrPayload(payload),
      });
    }
  }

  async startSender(
    transport: ILocalTransport,
    config: SessionConfig,
    addr: string,
    receiverPk?: string,
    sid?: string,
  ): Promise<void> {
    this.cleanup();
    this.update({ error: null });

    const session = new Session(SessionRole.Sender, config, sid);
    this.session = session;
    this.update({ sessionId: session.id, state: SessionState.Created });
    this.attachListeners(session);

    await session.startAsSender(transport, addr, receiverPk);
  }

  /** check if the given session is still the active one */
  isCurrentSession(session: Session): boolean {
    return this.session === session;
  }

  approve(): void {
    this.session?.approvePairing();
    this.update({ pairingRequest: null });
  }

  reject(reason?: string): void {
    this.session?.rejectPairing(reason);
    this.update({ pairingRequest: null });
  }

  sendData(text: string): void {
    if (!this.session) return;
    const bytes = new TextEncoder().encode(text);
    const seq = this.session.sendData(bytes);
    this.update({
      sentItems: [
        ...this.snapshot.sentItems,
        { seq, text, acked: false, timestamp: Date.now() },
      ],
    });
  }

  endSession(): void {
    this.cleanup();
    this.update({ sessionId: null });
  }

  destroy(): void {
    this.session?.close();
    this.session = null;
    this.listeners.clear();
  }
}
