import { Session } from "./session.js";
import type { SessionConfig } from "./session.js";
import { SessionState, SessionRole, SessionEvent } from "./types.js";
import type { PairingRequest } from "./types.js";
import type { ILocalTransport } from "../transport/index.js";
import type { QrPayload } from "../protocol/index.js";
import { PROTOCOL_VERSION, encodeQrPayload } from "../protocol/index.js";
import type { SessionId, NetworkAddress, SequenceNumber } from "../types/index.js";
import { asNetworkAddress } from "../types/index.js";
import { log } from "../logger.js";

export interface ReceivedItem {
  id: number;
  text: string;
  timestamp: number;
}

export interface SentItem {
  seq: SequenceNumber;
  text: string;
  acked: boolean;
  timestamp: number;
}

export interface SessionSnapshot {
  state: SessionState;
  sessionId: SessionId | null;
  qrPayload: string | null;
  localAddress: NetworkAddress | null;
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
  private starting = false;
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
      try {
        cb(this.snapshot);
      } catch (e) {
        log.warn("[session-controller] listener error:", e);
      }
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

    session.on(SessionEvent.DataAcknowledged, (seq: SequenceNumber) => {
      this.update({
        sentItems: this.snapshot.sentItems.map((item) =>
          item.seq === seq ? { ...item, acked: true } : item,
        ),
      });
    });

    session.on(SessionEvent.Error, (err: Error) => {
      log.warn(`[session-controller] error: ${err.message}`);
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

  async startReceiver(transport: ILocalTransport, config: SessionConfig): Promise<void> {
    if (this.starting) {
      log.warn("[session-controller] startReceiver called while already starting");
      return;
    }
    this.starting = true;

    try {
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
        const networkAddr = asNetworkAddress(addr);
        const pk = session.getPublicKey();
        if (!pk) {
          log.warn("[session-controller] public key not available after startAsReceiver");
          return;
        }
        const payload: QrPayload = {
          v: PROTOCOL_VERSION,
          sid: session.id,
          addr: networkAddr,
          pk,
          exp: session.getBootstrapTtl(),
        };
        this.update({
          localAddress: networkAddr,
          qrPayload: encodeQrPayload(payload),
        });
      }
    } catch (err) {
      // cleanup failed session to prevent dangling listeners
      if (this.session) {
        this.session.close();
        this.session = null;
      }
      this.update({
        state: SessionState.Closed,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      this.starting = false;
    }
  }

  async startSender(
    transport: ILocalTransport,
    config: SessionConfig,
    addr: string,
    receiverPk?: string,
    sid?: SessionId,
  ): Promise<void> {
    if (this.starting) {
      log.warn("[session-controller] startSender called while already starting");
      return;
    }
    this.starting = true;

    try {
      this.cleanup();
      this.update({ error: null });

      const session = new Session(SessionRole.Sender, config, sid);
      this.session = session;
      this.update({ sessionId: session.id, state: SessionState.Created });
      this.attachListeners(session);

      await session.startAsSender(transport, addr, receiverPk);
    } catch (err) {
      if (this.session) {
        this.session.close();
        this.session = null;
      }
      this.update({
        state: SessionState.Closed,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      this.starting = false;
    }
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
    // capture reference to avoid race with concurrent cleanup
    const session = this.session;
    if (!session) return;
    const bytes = new TextEncoder().encode(text);
    const seq = session.sendData(bytes);
    this.update({
      sentItems: [...this.snapshot.sentItems, { seq, text, acked: false, timestamp: Date.now() }],
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
