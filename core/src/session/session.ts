import {
  SessionState,
  SessionRole,
  SessionEvent,
  VALID_TRANSITIONS,
  type SessionEventMap,
  type PairingRequest,
} from "./types.js";
import {
  type KeyPair,
  type SharedSecret,
  generateKeyPair,
  deriveSharedSecret,
  encrypt,
  decrypt,
  generateSessionId,
  generateNonce,
  zeroMemory,
  toBase64,
  fromBase64,
} from "../crypto/index.js";
import {
  type ILocalTransport,
  type TransportState,
} from "../transport/index.js";
import {
  MessageType,
  type ProtocolMessage,
  type HelloMessage,
  type ChallengeMessage,
  type AuthMessage,
  type DataMessage,
  type AckMessage,
  serializeMessage,
  deserializeMessage,
  createBaseFields,
} from "../protocol/index.js";

/** default session expiry in seconds */
const DEFAULT_SESSION_TTL = 300;
/** default QR/code expiry in seconds */
const DEFAULT_BOOTSTRAP_TTL = 90;

export interface SessionConfig {
  /** session TTL in seconds (default 300) */
  sessionTtl?: number;
  /** QR/code expiry in seconds (default 90) */
  bootstrapTtl?: number;
  /** device name shown during pairing */
  deviceName: string;
  /** port to listen on (receiver only) */
  port?: number;
}

export class Session {
  readonly id: string;
  readonly role: SessionRole;

  private state: SessionState = SessionState.Created;
  private keyPair: KeyPair | null = null;
  private sharedSecret: SharedSecret | null = null;
  private peerPublicKey: Uint8Array | null = null;
  private challengeNonce: Uint8Array | null = null;
  private seq = 0;
  private expectedSeq = 0;
  private createdAt: number;
  private config: Required<SessionConfig>;
  private transport: ILocalTransport | null = null;
  private listeners: Map<SessionEvent, Set<(...args: any[]) => void>> =
    new Map();

  constructor(role: SessionRole, config: SessionConfig, id?: string) {
    this.role = role;
    this.id = id ?? generateSessionId();
    this.createdAt = Date.now();
    this.config = {
      sessionTtl: config.sessionTtl ?? DEFAULT_SESSION_TTL,
      bootstrapTtl: config.bootstrapTtl ?? DEFAULT_BOOTSTRAP_TTL,
      deviceName: config.deviceName,
      port: config.port ?? 4040,
    };
  }

  /** get current session state */
  getState(): SessionState {
    return this.state;
  }

  /** get our ephemeral public key (base64) */
  getPublicKey(): string | null {
    return this.keyPair ? toBase64(this.keyPair.publicKey) : null;
  }

  /** get bootstrap TTL (for QR expiry field) */
  getBootstrapTtl(): number {
    return this.config.bootstrapTtl;
  }

  /** check if the bootstrap window (QR/code) has expired */
  isBootstrapExpired(): boolean {
    const elapsed = (Date.now() - this.createdAt) / 1000;
    return elapsed > this.config.bootstrapTtl;
  }

  /** check if the session has expired */
  isSessionExpired(): boolean {
    const elapsed = (Date.now() - this.createdAt) / 1000;
    return elapsed > this.config.sessionTtl;
  }

  // -- event emitter --

  on<E extends SessionEvent>(event: E, cb: SessionEventMap[E]): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(cb);
  }

  off<E extends SessionEvent>(event: E, cb: SessionEventMap[E]): void {
    this.listeners.get(event)?.delete(cb);
  }

  private emit<E extends SessionEvent>(
    event: E,
    ...args: Parameters<SessionEventMap[E]>
  ): void {
    const cbs = this.listeners.get(event);
    if (!cbs) return;
    for (const cb of cbs) {
      try {
        (cb as (...a: any[]) => void)(...args);
      } catch (err) {
        // don't let listener errors crash the session
        console.error("session event listener error:", err);
      }
    }
  }

  // -- lifecycle: receiver --

  /**
   * receiver: start the session — generate keys, bind transport, wait for sender.
   */
  async startAsReceiver(transport: ILocalTransport): Promise<void> {
    this.assertState(SessionState.Created);
    this.transport = transport;
    this.keyPair = generateKeyPair();

    transport.onMessage((data) => this.handleIncoming(data));
    transport.onStateChange((ts) => this.handleTransportState(ts));

    await transport.listen(this.config.port);
    this.transition(SessionState.WaitingForSender);
  }

  /**
   * receiver: approve a pending pairing request.
   */
  approvePairing(): void {
    this.assertState(SessionState.PendingApproval);
    this.transition(SessionState.Active);
    this.sendMessage({
      ...createBaseFields(MessageType.ACCEPT, this.id, this.nextSeq()),
    });
  }

  /**
   * receiver: reject a pending pairing request.
   */
  rejectPairing(reason?: string): void {
    this.assertState(SessionState.PendingApproval);
    this.transition(SessionState.Rejected);
    this.sendMessage({
      ...createBaseFields(MessageType.REJECT, this.id, this.nextSeq()),
      reason,
    });
    this.close();
  }

  // -- lifecycle: sender --

  /**
   * sender: connect to receiver and start handshake.
   * @param addr - receiver's address (ip:port)
   * @param receiverPublicKey - receiver's public key from QR or discovery
   */
  async startAsSender(
    transport: ILocalTransport,
    addr: string,
    receiverPublicKey?: string,
  ): Promise<void> {
    this.assertState(SessionState.Created);
    this.transport = transport;
    this.keyPair = generateKeyPair();

    if (receiverPublicKey) {
      this.peerPublicKey = fromBase64(receiverPublicKey);
    }

    transport.onMessage((data) => this.handleIncoming(data));
    transport.onStateChange((ts) => this.handleTransportState(ts));

    await transport.connect(addr);
    this.transition(SessionState.Handshaking);

    // send HELLO
    this.sendMessage({
      ...createBaseFields(MessageType.HELLO, this.id, this.nextSeq()),
      pk: toBase64(this.keyPair.publicKey),
      deviceName: this.config.deviceName,
    });
  }

  // -- data transfer --

  /**
   * send sensitive data (password, OTP, text) to the peer.
   * data is encrypted before transmission.
   */
  sendData(plaintext: Uint8Array): number {
    this.assertState(SessionState.Active);
    if (!this.sharedSecret) {
      throw new Error("no shared secret — handshake incomplete");
    }

    const envelope = encrypt(plaintext, this.sharedSecret.encryptionKey);
    const seq = this.nextSeq();

    this.sendMessage({
      ...createBaseFields(MessageType.DATA, this.id, seq),
      ciphertext: toBase64(envelope.ciphertext),
      nonce: toBase64(envelope.nonce),
    });

    return seq;
  }

  // -- teardown --

  /**
   * close the session, zero secrets, release transport.
   */
  close(): void {
    if (this.state === SessionState.Closed) return;

    // send CLOSE if transport is connected
    if (
      this.transport &&
      this.transport.getState() === "connected"
    ) {
      try {
        this.sendMessage({
          ...createBaseFields(MessageType.CLOSE, this.id, this.nextSeq()),
        });
      } catch {
        // best effort
      }
    }

    this.cleanup();
    this.transition(SessionState.Closed);
  }

  // -- internal message handling --

  private handleIncoming(data: Uint8Array): void {
    try {
      const msg = deserializeMessage(data);

      if (msg.sid !== this.id) {
        return; // wrong session, ignore
      }

      switch (msg.type) {
        case MessageType.HELLO:
          this.handleHello(msg as HelloMessage);
          break;
        case MessageType.CHALLENGE:
          this.handleChallenge(msg as ChallengeMessage);
          break;
        case MessageType.AUTH:
          this.handleAuth(msg as AuthMessage);
          break;
        case MessageType.ACCEPT:
          this.handleAccept();
          break;
        case MessageType.REJECT:
          this.handleReject();
          break;
        case MessageType.DATA:
          this.handleData(msg as DataMessage);
          break;
        case MessageType.ACK:
          this.handleAck(msg as AckMessage);
          break;
        case MessageType.CLOSE:
          this.handleClose();
          break;
      }
    } catch (err) {
      this.emit(
        SessionEvent.Error,
        err instanceof Error ? err : new Error(String(err)),
      );
    }
  }

  /** receiver handles HELLO from sender */
  private handleHello(msg: HelloMessage): void {
    if (this.role !== SessionRole.Receiver) return;
    if (this.state !== SessionState.WaitingForSender) return;
    if (this.isBootstrapExpired()) {
      this.close();
      return;
    }

    this.peerPublicKey = fromBase64(msg.pk);
    this.transition(SessionState.Handshaking);

    // send CHALLENGE with our public key and a nonce
    this.challengeNonce = generateNonce();
    this.sendMessage({
      ...createBaseFields(MessageType.CHALLENGE, this.id, this.nextSeq()),
      nonce: toBase64(this.challengeNonce),
      pk: toBase64(this.keyPair!.publicKey),
    });
  }

  /** sender handles CHALLENGE from receiver */
  private handleChallenge(msg: ChallengeMessage): void {
    if (this.role !== SessionRole.Sender) return;
    if (this.state !== SessionState.Handshaking) return;

    // if we didn't get the receiver's pk from QR, get it from the challenge
    if (!this.peerPublicKey) {
      this.peerPublicKey = fromBase64(msg.pk);
    }

    // derive shared secret
    this.sharedSecret = deriveSharedSecret(
      this.keyPair!,
      this.peerPublicKey,
      false,
    );

    // prove we have the correct key by encrypting the challenge nonce
    const challengeNonce = fromBase64(msg.nonce);
    const proof = encrypt(challengeNonce, this.sharedSecret.encryptionKey);

    this.sendMessage({
      ...createBaseFields(MessageType.AUTH, this.id, this.nextSeq()),
      proof: toBase64(
        new Uint8Array([...proof.nonce, ...proof.ciphertext]),
      ),
    });
  }

  /** receiver handles AUTH from sender */
  private handleAuth(msg: AuthMessage): void {
    if (this.role !== SessionRole.Receiver) return;
    if (this.state !== SessionState.Handshaking) return;

    // derive shared secret on receiver side
    this.sharedSecret = deriveSharedSecret(
      this.keyPair!,
      this.peerPublicKey!,
      true,
    );

    // verify the proof
    const proofBytes = fromBase64(msg.proof);
    const nonceLen = 24; // XChaCha20 nonce size
    const proofNonce = proofBytes.slice(0, nonceLen);
    const proofCiphertext = proofBytes.slice(nonceLen);

    try {
      const decrypted = decrypt(
        { nonce: proofNonce, ciphertext: proofCiphertext },
        this.sharedSecret.encryptionKey,
      );

      // verify decrypted matches our challenge nonce
      if (!constantTimeEqual(decrypted, this.challengeNonce!)) {
        throw new Error("challenge proof mismatch");
      }
    } catch {
      this.emit(SessionEvent.Error, new Error("auth failed: invalid proof"));
      this.rejectPairing("authentication failed");
      return;
    }

    // auth passed — move to pending approval (receiver decides)
    this.transition(SessionState.PendingApproval);
    this.emit(SessionEvent.PairingRequest, {
      deviceName: "Unknown Device", // will be set from HELLO
      publicKey: this.peerPublicKey!,
    });
  }

  /** sender handles ACCEPT */
  private handleAccept(): void {
    if (this.role !== SessionRole.Sender) return;
    if (
      this.state !== SessionState.Handshaking &&
      this.state !== SessionState.PendingApproval
    ) {
      return;
    }
    this.transition(SessionState.Active);
  }

  /** sender handles REJECT */
  private handleReject(): void {
    if (this.role !== SessionRole.Sender) return;
    this.transition(SessionState.Rejected);
    this.cleanup();
    this.transition(SessionState.Closed);
  }

  /** handle incoming encrypted DATA */
  private handleData(msg: DataMessage): void {
    if (this.state !== SessionState.Active) return;
    if (!this.sharedSecret) return;

    const ciphertext = fromBase64(msg.ciphertext);
    const nonce = fromBase64(msg.nonce);

    const plaintext = decrypt(
      { ciphertext, nonce },
      this.sharedSecret.encryptionKey,
    );

    this.emit(SessionEvent.DataReceived, plaintext);

    // send ACK
    this.sendMessage({
      ...createBaseFields(MessageType.ACK, this.id, this.nextSeq()),
      ackSeq: msg.seq,
    });
  }

  /** handle ACK */
  private handleAck(msg: AckMessage): void {
    if (this.state !== SessionState.Active) return;
    this.emit(SessionEvent.DataAcknowledged, msg.ackSeq);
  }

  /** handle CLOSE from peer */
  private handleClose(): void {
    this.cleanup();
    this.transition(SessionState.Closed);
  }

  // -- transport state --

  private handleTransportState(ts: TransportState): void {
    if (ts === "disconnected" && this.state !== SessionState.Closed) {
      this.emit(SessionEvent.Error, new Error("transport disconnected"));
      this.cleanup();
      this.transition(SessionState.Closed);
    }
  }

  // -- helpers --

  private sendMessage(msg: ProtocolMessage): void {
    if (!this.transport) {
      throw new Error("no transport bound");
    }
    this.transport.send(serializeMessage(msg));
  }

  private nextSeq(): number {
    return ++this.seq;
  }

  private transition(next: SessionState): void {
    const allowed = VALID_TRANSITIONS[this.state];
    if (!allowed.includes(next)) {
      throw new Error(
        `invalid state transition: ${this.state} -> ${next}`,
      );
    }
    this.state = next;
    this.emit(SessionEvent.StateChanged, next);
  }

  private assertState(expected: SessionState): void {
    if (this.state !== expected) {
      throw new Error(
        `expected state ${expected}, got ${this.state}`,
      );
    }
  }

  private cleanup(): void {
    // zero all sensitive material
    if (this.keyPair) {
      zeroMemory(this.keyPair.secretKey);
      this.keyPair = null;
    }
    if (this.sharedSecret) {
      zeroMemory(this.sharedSecret.encryptionKey);
      this.sharedSecret = null;
    }
    if (this.challengeNonce) {
      zeroMemory(this.challengeNonce);
      this.challengeNonce = null;
    }
    if (this.peerPublicKey) {
      this.peerPublicKey = null;
    }

    // close transport
    this.transport?.close();
    this.transport = null;

    // clear listeners
    this.listeners.clear();
  }
}

/** constant-time comparison to prevent timing attacks */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}
