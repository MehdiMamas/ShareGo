import { SessionState, SessionRole, SessionEvent, type SessionEventMap } from "./types.js";
import { createActor } from "xstate";
import { sessionMachine, STATE_TO_EVENT } from "./machine.js";
// sessionMachine is used in constructor to create the actor
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
  PUBLIC_KEY_LENGTH,
  NONCE_LENGTH,
  constantTimeEqual,
} from "../crypto/index.js";
import { type ILocalTransport, type TransportState } from "../transport/index.js";
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
  serializeBinaryData,
  deserializeBinaryData,
  isBinaryDataFrame,
} from "../protocol/index.js";
import {
  SESSION_TTL as DEFAULT_SESSION_TTL,
  BOOTSTRAP_TTL as DEFAULT_BOOTSTRAP_TTL,
  DEFAULT_PORT,
  MAX_SEQ_GAP,
} from "../config.js";
import type { SessionId, Base64PublicKey, Base64Proof, SequenceNumber } from "../types/index.js";
import { asSessionId, asBase64PublicKey, asBase64Nonce, asSequenceNumber } from "../types/index.js";

export { DEFAULT_PORT };

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
  readonly id: SessionId;
  readonly role: SessionRole;

  private keyPair: KeyPair | null = null;
  private sharedSecret: SharedSecret | null = null;
  private peerPublicKey: Uint8Array | null = null;
  private challengeNonce: Uint8Array | null = null;
  private peerDeviceName: string | null = null;
  private seq: SequenceNumber = asSequenceNumber(0);
  private highestSeenSeq: SequenceNumber = asSequenceNumber(0);
  private helloReceived = false;
  private createdAt: number;
  private config: Required<SessionConfig>;
  private transport: ILocalTransport | null = null;
  private listeners: Map<SessionEvent, Set<(...args: any[]) => void>> = new Map();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private closing = false;
  private machineActor;

  constructor(role: SessionRole, config: SessionConfig, id?: SessionId) {
    this.role = role;
    this.id = id ?? asSessionId(generateSessionId());
    this.createdAt = Date.now();
    this.config = {
      sessionTtl: config.sessionTtl ?? DEFAULT_SESSION_TTL,
      bootstrapTtl: config.bootstrapTtl ?? DEFAULT_BOOTSTRAP_TTL,
      deviceName: config.deviceName,
      port: config.port ?? DEFAULT_PORT,
    };
    // initialize the xstate actor with the correct role context
    this.machineActor = createActor(sessionMachine, {
      snapshot: sessionMachine.resolveState({
        value: SessionState.Created,
        context: { role },
      }),
    });
    this.machineActor.start();
  }

  /** get current session state (from XState actor — single source of truth) */
  getState(): SessionState {
    return String(this.machineActor.getSnapshot().value) as SessionState;
  }

  /** get our ephemeral public key (base64) */
  getPublicKey(): Base64PublicKey | null {
    return this.keyPair ? asBase64PublicKey(toBase64(this.keyPair.publicKey)) : null;
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

  private emit<E extends SessionEvent>(event: E, ...args: Parameters<SessionEventMap[E]>): void {
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

    // session may have been closed during the async listen (e.g. react strict mode cleanup)
    if (this.getState() === SessionState.Closed) return;

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
    // send REJECT before transitioning so transport is still available
    this.sendMessage({
      ...createBaseFields(MessageType.REJECT, this.id, this.nextSeq()),
      reason,
    });
    this.transition(SessionState.Rejected);
    this.cleanup();
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

    // session may have been closed during the async connect
    if (this.getState() === SessionState.Closed) return;

    this.transition(SessionState.Handshaking);

    // send HELLO
    this.sendMessage({
      ...createBaseFields(MessageType.HELLO, this.id, this.nextSeq()),
      pk: asBase64PublicKey(toBase64(this.keyPair.publicKey)),
      deviceName: this.config.deviceName,
    });
  }

  // -- data transfer --

  /**
   * send sensitive data (password, OTP, text) to the peer.
   * data is encrypted before transmission.
   */
  sendData(plaintext: Uint8Array): SequenceNumber {
    if (this.closing) {
      throw new Error("session is closing");
    }
    this.assertState(SessionState.Active);
    if (!this.sharedSecret) {
      throw new Error("no shared secret — handshake incomplete");
    }

    const envelope = encrypt(plaintext, this.sharedSecret.encryptionKey);
    const seq = this.nextSeq();

    // send DATA as compact binary frame (avoids ~33% base64 overhead)
    const binaryFrame = serializeBinaryData(seq, envelope.nonce, envelope.ciphertext);
    if (this.getState() === SessionState.Closed) return seq;
    if (!this.transport) throw new Error("no transport bound");
    this.transport.send(binaryFrame);

    return seq;
  }

  // -- teardown --

  /**
   * close the session, zero secrets, release transport.
   * sends a CLOSE message to the peer then cleans up after a short flush delay
   * so the message actually reaches the wire before the transport is torn down.
   */
  close(): void {
    if (this.getState() === SessionState.Closed || this.closing) return;
    this.closing = true;

    // cancel any pending flush timer from a previous close() call
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    // send CLOSE if transport is connected
    if (this.transport && this.transport.getState() === "connected") {
      try {
        this.sendMessage({
          ...createBaseFields(MessageType.CLOSE, this.id, this.nextSeq()),
        });
      } catch {
        // best effort
      }

      // transition immediately so no further messages are processed
      this.transition(SessionState.Closed);

      // delay cleanup to let the CLOSE message flush over the wire.
      // keep transport reference alive until the timeout fires.
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        this.cleanupKeys();
        this.transport?.close();
        this.transport = null;
      }, 200);
      return;
    }

    this.transition(SessionState.Closed);
    this.cleanup();
  }

  // -- internal message handling --

  private handleIncoming(data: Uint8Array): void {
    // ignore messages after session is closed or rejected
    if (this.getState() === SessionState.Closed || this.getState() === SessionState.Rejected)
      return;

    // enforce session expiry before spending CPU on deserialization
    if (this.isSessionExpired()) {
      this.emit(SessionEvent.Error, new Error("session expired"));
      this.close();
      return;
    }

    try {
      // binary DATA frames start with 0x01; JSON messages start with '{' (0x7B)
      if (isBinaryDataFrame(data)) {
        this.handleBinaryData(data);
        return;
      }

      const msg = deserializeMessage(data);

      if (msg.sid !== this.id) {
        return; // wrong session, ignore
      }

      // validate sequence numbers for replay detection and gap attacks
      if (msg.seq <= this.highestSeenSeq) {
        return; // duplicate or replayed message, ignore
      }
      if (msg.seq > (this.highestSeenSeq as number) + MAX_SEQ_GAP) {
        this.emit(SessionEvent.Error, new Error("sequence number gap too large"));
        this.close();
        return;
      }
      this.highestSeenSeq = msg.seq;

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
          // legacy JSON DATA support (for backward compat)
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
      this.emit(SessionEvent.Error, err instanceof Error ? err : new Error(String(err)));
    }
  }

  /** handle binary DATA frame (compact format without base64 overhead) */
  private handleBinaryData(data: Uint8Array): void {
    if (this.getState() !== SessionState.Active) return;
    if (!this.sharedSecret) return;

    const frame = deserializeBinaryData(data);

    // replay detection
    if (frame.seq <= this.highestSeenSeq) return;
    if (frame.seq > (this.highestSeenSeq as number) + MAX_SEQ_GAP) {
      this.emit(SessionEvent.Error, new Error("sequence number gap too large"));
      this.close();
      return;
    }
    this.highestSeenSeq = frame.seq;

    const plaintext = decrypt(
      { ciphertext: frame.ciphertext, nonce: frame.nonce },
      this.sharedSecret.encryptionKey,
    );

    this.emit(SessionEvent.DataReceived, plaintext);

    // send ACK (still JSON for debuggability)
    this.sendMessage({
      ...createBaseFields(MessageType.ACK, this.id, this.nextSeq()),
      ackSeq: frame.seq,
    });
  }

  /** receiver handles HELLO from sender */
  private handleHello(msg: HelloMessage): void {
    if (this.role !== SessionRole.Receiver) return;
    if (this.getState() !== SessionState.WaitingForSender) return;
    if (this.helloReceived) return; // reject duplicate/replayed HELLO
    this.helloReceived = true;
    if (this.isBootstrapExpired()) {
      this.close();
      return;
    }

    const peerPk = fromBase64(msg.pk);
    if (peerPk.length !== PUBLIC_KEY_LENGTH) {
      this.emit(
        SessionEvent.Error,
        new Error(`invalid public key length: got ${peerPk.length}, expected ${PUBLIC_KEY_LENGTH}`),
      );
      this.close();
      return;
    }
    this.peerPublicKey = peerPk;
    this.peerDeviceName = msg.deviceName ?? "Unknown Device";
    this.transition(SessionState.Handshaking);

    // send CHALLENGE with our public key and a nonce
    this.challengeNonce = generateNonce();
    this.sendMessage({
      ...createBaseFields(MessageType.CHALLENGE, this.id, this.nextSeq()),
      nonce: asBase64Nonce(toBase64(this.challengeNonce)),
      pk: asBase64PublicKey(toBase64(this.keyPair!.publicKey)),
    });
  }

  /** sender handles CHALLENGE from receiver */
  private handleChallenge(msg: ChallengeMessage): void {
    if (this.role !== SessionRole.Sender) return;
    if (this.getState() !== SessionState.Handshaking) return;
    if (this.isBootstrapExpired()) {
      this.close();
      return;
    }

    // if we didn't get the receiver's pk from QR, get it from the challenge
    if (!this.peerPublicKey) {
      const peerPk = fromBase64(msg.pk);
      if (peerPk.length !== PUBLIC_KEY_LENGTH) {
        this.emit(
          SessionEvent.Error,
          new Error(
            `invalid public key length: got ${peerPk.length}, expected ${PUBLIC_KEY_LENGTH}`,
          ),
        );
        this.close();
        return;
      }
      this.peerPublicKey = peerPk;
    }

    // derive shared secret
    this.sharedSecret = deriveSharedSecret(this.keyPair!, this.peerPublicKey, false);

    // prove we have the correct key by encrypting the challenge nonce
    const challengeNonce = fromBase64(msg.nonce);
    const proof = encrypt(challengeNonce, this.sharedSecret.encryptionKey);

    this.sendMessage({
      ...createBaseFields(MessageType.AUTH, this.id, this.nextSeq()),
      proof: toBase64(new Uint8Array([...proof.nonce, ...proof.ciphertext])) as Base64Proof,
    });
  }

  /** receiver handles AUTH from sender */
  private handleAuth(msg: AuthMessage): void {
    if (this.role !== SessionRole.Receiver) return;
    if (this.getState() !== SessionState.Handshaking) return;
    if (this.isBootstrapExpired()) {
      this.close();
      return;
    }

    // derive shared secret on receiver side
    this.sharedSecret = deriveSharedSecret(this.keyPair!, this.peerPublicKey!, true);

    // verify the proof — always zero proof material regardless of outcome
    const proofBytes = fromBase64(msg.proof);
    const proofNonce = proofBytes.slice(0, NONCE_LENGTH);
    const proofCiphertext = proofBytes.slice(NONCE_LENGTH);

    // eslint-disable-next-line no-useless-assignment -- initial value is the fallback if decrypt throws
    let authValid = false;
    try {
      const decrypted = decrypt(
        { nonce: proofNonce, ciphertext: proofCiphertext },
        this.sharedSecret.encryptionKey,
      );
      authValid = constantTimeEqual(decrypted, this.challengeNonce!);
    } catch {
      authValid = false;
    } finally {
      zeroMemory(proofBytes);
    }

    if (!authValid) {
      this.emit(SessionEvent.Error, new Error("auth failed: invalid proof"));
      try {
        this.sendMessage({
          ...createBaseFields(MessageType.REJECT, this.id, this.nextSeq()),
          reason: "authentication failed",
        });
      } catch {
        // best effort
      }
      this.transition(SessionState.Rejected);
      this.cleanup();
      return;
    }

    // auth passed — move to pending approval (receiver decides)
    this.transition(SessionState.PendingApproval);
    this.emit(SessionEvent.PairingRequest, {
      deviceName: this.peerDeviceName ?? "Unknown Device",
      publicKey: this.peerPublicKey!,
    });
  }

  /** sender handles ACCEPT */
  private handleAccept(): void {
    if (this.role !== SessionRole.Sender) return;
    if (this.getState() !== SessionState.Handshaking) return;
    this.transition(SessionState.Active);
  }

  /** sender handles REJECT */
  private handleReject(): void {
    if (this.role !== SessionRole.Sender) return;
    this.transition(SessionState.Rejected);
    this.cleanup();
  }

  /** handle incoming encrypted DATA */
  private handleData(msg: DataMessage): void {
    if (this.getState() !== SessionState.Active) return;
    if (!this.sharedSecret) return;

    const ciphertext = fromBase64(msg.ciphertext);
    const nonce = fromBase64(msg.nonce);

    const plaintext = decrypt({ ciphertext, nonce }, this.sharedSecret.encryptionKey);

    this.emit(SessionEvent.DataReceived, plaintext);

    // send ACK
    this.sendMessage({
      ...createBaseFields(MessageType.ACK, this.id, this.nextSeq()),
      ackSeq: msg.seq,
    });
  }

  /** handle ACK */
  private handleAck(msg: AckMessage): void {
    if (this.getState() !== SessionState.Active) return;
    this.emit(SessionEvent.DataAcknowledged, msg.ackSeq);
  }

  /** handle CLOSE from peer */
  private handleClose(): void {
    this.closing = true;
    // cancel any pending flush timer from a prior close() call
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    // transition before cleanup so StateChanged event fires while listeners exist
    this.transition(SessionState.Closed);
    this.cleanup();
  }

  // -- transport state --

  private handleTransportState(ts: TransportState): void {
    if (
      ts === "disconnected" &&
      this.getState() !== SessionState.Closed &&
      this.getState() !== SessionState.Rejected
    ) {
      this.emit(SessionEvent.Error, new Error("transport disconnected"));
      // transition before cleanup so StateChanged event fires while listeners exist
      this.transition(SessionState.Closed);
      this.cleanup();
    }
  }

  // -- helpers --

  private sendMessage(msg: ProtocolMessage): void {
    if (this.getState() === SessionState.Closed) {
      return; // silently drop messages after close
    }
    if (!this.transport) {
      throw new Error("no transport bound");
    }
    this.transport.send(serializeMessage(msg));
  }

  private nextSeq(): SequenceNumber {
    if ((this.seq as number) >= 0xffffffff) {
      throw new Error("sequence number overflow");
    }
    this.seq = asSequenceNumber((this.seq as number) + 1);
    return this.seq;
  }

  private transition(next: SessionState): void {
    const current = this.getState();
    const key = `${current}->${next}`;
    const eventType = STATE_TO_EVENT[key];
    if (!eventType) {
      throw new Error(`invalid state transition: ${current} -> ${next}`);
    }

    // advance the xstate actor — single source of truth for state
    this.machineActor.send({ type: eventType });
    const after = this.getState();

    if (after !== next) {
      throw new Error(`invalid state transition: ${current} -> ${next} (machine reached ${after})`);
    }

    this.emit(SessionEvent.StateChanged, next);
  }

  private assertState(expected: SessionState): void {
    if (this.getState() !== expected) {
      throw new Error(`expected state ${expected}, got ${this.getState()}`);
    }
  }

  /** zero all key material without touching the transport */
  private cleanupKeys(): void {
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
      zeroMemory(this.peerPublicKey);
      this.peerPublicKey = null;
    }
    this.peerDeviceName = null;
    this.listeners.clear();
  }

  private cleanup(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.cleanupKeys();

    // close transport
    this.transport?.close();
    this.transport = null;
  }
}
