import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { Session, DEFAULT_PORT } from "./session.js";
import {
  SessionState,
  SessionRole,
  SessionEvent,
} from "./types.js";
import { sessionMachine } from "./machine.js";
import { initCrypto } from "../crypto/index.js";
import { serializeMessage, deserializeMessage, createBaseFields } from "../protocol/index.js";
import { MessageType, PROTOCOL_VERSION } from "../protocol/types.js";
import type {
  ILocalTransport,
  TransportState,
  TransportStateCallback,
  MessageCallback,
} from "../transport/types.js";

/** minimal mock transport that connects two sides in-memory */
class MockTransport implements ILocalTransport {
  private state: TransportState = "idle";
  private stateCallbacks: TransportStateCallback[] = [];
  private messageCallbacks: MessageCallback[] = [];
  peer: MockTransport | null = null;

  async listen(_port: number): Promise<void> {
    this.state = "listening";
    for (const cb of this.stateCallbacks) cb("listening");
  }

  async connect(_addr: string): Promise<void> {
    this.state = "connected";
    for (const cb of this.stateCallbacks) cb("connected");
  }

  send(data: Uint8Array): void {
    // deliver to the other side synchronously
    if (this.peer) {
      for (const cb of this.peer.messageCallbacks) {
        cb(data);
      }
    }
  }

  onMessage(cb: MessageCallback): void {
    this.messageCallbacks.push(cb);
  }

  onStateChange(cb: TransportStateCallback): void {
    this.stateCallbacks.push(cb);
  }

  close(): void {
    this.state = "closed";
  }

  getState(): TransportState {
    return this.state;
  }

  getLocalAddress(): string | null {
    return "127.0.0.1:4040";
  }

  // simulate a connection arriving from the sender
  simulateConnection(): void {
    this.state = "connected";
    for (const cb of this.stateCallbacks) cb("connected");
  }
}

beforeAll(async () => {
  await initCrypto();
});

describe("Session construction", () => {
  it("should create a session with the correct role and state", () => {
    const session = new Session(SessionRole.Receiver, { deviceName: "Test" });
    expect(session.role).toBe(SessionRole.Receiver);
    expect(session.getState()).toBe(SessionState.Created);
    expect(session.id).toHaveLength(6);
  });

  it("should accept a custom session id", () => {
    const session = new Session(SessionRole.Sender, { deviceName: "Test" }, "CUSTOM");
    expect(session.id).toBe("CUSTOM");
  });

  it("should return null public key before key generation", () => {
    const session = new Session(SessionRole.Receiver, { deviceName: "Test" });
    expect(session.getPublicKey()).toBeNull();
  });
});

describe("Session state machine", () => {
  it("should define states for all SessionState values", () => {
    const config = sessionMachine.config.states!;
    for (const state of Object.values(SessionState)) {
      expect(config[state]).toBeDefined();
    }
  });

  it("should mark Closed as a final state with no outgoing transitions", () => {
    const config = sessionMachine.config.states!;
    expect(config[SessionState.Closed]).toHaveProperty("type", "final");
  });

  it("should have END_SESSION as the only transition from Rejected", () => {
    const config = sessionMachine.config.states!;
    const rejectedOn = config[SessionState.Rejected]?.on as Record<string, { target: string }> | undefined;
    expect(rejectedOn).toBeDefined();
    const targets = Object.values(rejectedOn!).map((t) => t.target);
    expect(targets).toEqual([SessionState.Closed]);
  });
});

describe("Session receiver lifecycle", () => {
  let receiverTransport: MockTransport;
  let receiver: Session;

  beforeEach(() => {
    receiverTransport = new MockTransport();
    receiver = new Session(SessionRole.Receiver, {
      deviceName: "Receiver",
      port: DEFAULT_PORT,
      bootstrapTtl: 90,
    });
  });

  it("should transition to WaitingForSender after startAsReceiver", async () => {
    const states: SessionState[] = [];
    receiver.on(SessionEvent.StateChanged, (s) => states.push(s));

    await receiver.startAsReceiver(receiverTransport);

    expect(receiver.getState()).toBe(SessionState.WaitingForSender);
    expect(states).toContain(SessionState.WaitingForSender);
    expect(receiver.getPublicKey()).not.toBeNull();
  });

  it("should reject startAsReceiver if not in Created state", async () => {
    await receiver.startAsReceiver(receiverTransport);
    const transport2 = new MockTransport();
    await expect(receiver.startAsReceiver(transport2)).rejects.toThrow(
      "expected state Created",
    );
  });
});

describe("Session sender lifecycle", () => {
  let senderTransport: MockTransport;
  let sender: Session;

  beforeEach(() => {
    senderTransport = new MockTransport();
    sender = new Session(SessionRole.Sender, { deviceName: "Sender" }, "SESS01");
  });

  it("should transition to Handshaking after startAsSender", async () => {
    const states: SessionState[] = [];
    sender.on(SessionEvent.StateChanged, (s) => states.push(s));

    await sender.startAsSender(senderTransport, "192.168.1.1:4040");

    expect(sender.getState()).toBe(SessionState.Handshaking);
    expect(states).toContain(SessionState.Handshaking);
  });
});

describe("Session full handshake flow", () => {
  let receiverTransport: MockTransport;
  let senderTransport: MockTransport;
  let receiver: Session;
  let sender: Session;

  beforeEach(async () => {
    receiverTransport = new MockTransport();
    senderTransport = new MockTransport();

    // cross-link transports so send() on one delivers to the other
    receiverTransport.peer = senderTransport;
    senderTransport.peer = receiverTransport;

    receiver = new Session(SessionRole.Receiver, {
      deviceName: "Receiver",
      port: DEFAULT_PORT,
      bootstrapTtl: 90,
    });
    sender = new Session(SessionRole.Sender, { deviceName: "Sender" }, receiver.id);
  });

  it("should complete handshake and reach Active state", async () => {
    // start receiver
    await receiver.startAsReceiver(receiverTransport);
    receiverTransport.simulateConnection();
    expect(receiver.getState()).toBe(SessionState.WaitingForSender);

    // track pairing request
    let pairingRequest: unknown = null;
    receiver.on(SessionEvent.PairingRequest, (req) => {
      pairingRequest = req;
    });

    // start sender — sends HELLO, which triggers CHALLENGE -> AUTH flow
    await sender.startAsSender(senderTransport, "192.168.1.1:4040");

    // after the full handshake, receiver should be in PendingApproval
    expect(receiver.getState()).toBe(SessionState.PendingApproval);
    expect(pairingRequest).not.toBeNull();

    // approve pairing
    receiver.approvePairing();
    expect(receiver.getState()).toBe(SessionState.Active);
    expect(sender.getState()).toBe(SessionState.Active);
  });

  it("should exchange encrypted data after handshake", async () => {
    await receiver.startAsReceiver(receiverTransport);
    receiverTransport.simulateConnection();

    receiver.on(SessionEvent.PairingRequest, () => {
      receiver.approvePairing();
    });

    await sender.startAsSender(senderTransport, "192.168.1.1:4040");

    // both should be active
    expect(receiver.getState()).toBe(SessionState.Active);
    expect(sender.getState()).toBe(SessionState.Active);

    // sender sends data to receiver
    const receivedData: string[] = [];
    receiver.on(SessionEvent.DataReceived, (plaintext: Uint8Array) => {
      receivedData.push(new TextDecoder().decode(plaintext));
    });

    const ackedSeqs: number[] = [];
    sender.on(SessionEvent.DataAcknowledged, (seq: number) => {
      ackedSeqs.push(seq);
    });

    const seq = sender.sendData(new TextEncoder().encode("mypassword123"));

    expect(receivedData).toEqual(["mypassword123"]);
    expect(ackedSeqs).toEqual([seq]);
  });

  it("should handle rejection by receiver", async () => {
    await receiver.startAsReceiver(receiverTransport);
    receiverTransport.simulateConnection();

    receiver.on(SessionEvent.PairingRequest, () => {
      receiver.rejectPairing("not allowed");
    });

    await sender.startAsSender(senderTransport, "192.168.1.1:4040");

    // receiver transitions to Rejected (terminal state) after rejecting
    expect(receiver.getState()).toBe(SessionState.Rejected);
    expect(sender.getState()).toBe(SessionState.Rejected);
  });

  it("should handle session close", async () => {
    await receiver.startAsReceiver(receiverTransport);
    receiverTransport.simulateConnection();

    receiver.on(SessionEvent.PairingRequest, () => {
      receiver.approvePairing();
    });

    await sender.startAsSender(senderTransport, "192.168.1.1:4040");

    expect(receiver.getState()).toBe(SessionState.Active);

    // close from receiver side
    receiver.close();
    expect(receiver.getState()).toBe(SessionState.Closed);
    // sender should also get CLOSE and transition
    expect(sender.getState()).toBe(SessionState.Closed);
  });
});

describe("Session replay detection", () => {
  it("should reject messages with already-seen sequence numbers", async () => {
    const receiverTransport = new MockTransport();
    const senderTransport = new MockTransport();
    receiverTransport.peer = senderTransport;
    senderTransport.peer = receiverTransport;

    const receiver = new Session(SessionRole.Receiver, {
      deviceName: "R",
      bootstrapTtl: 90,
    });

    await receiver.startAsReceiver(receiverTransport);
    receiverTransport.simulateConnection();

    // manually send a HELLO with seq 5
    const hello = serializeMessage({
      ...createBaseFields(MessageType.HELLO, receiver.id, 5),
      pk: "dGVzdA", // dummy base64 that will fail length check, but seq check happens first for non-HELLO
      deviceName: "Sender",
    });

    // send it — this should be processed (it's the first HELLO)
    for (const cb of (receiverTransport as any).messageCallbacks) {
      cb(hello);
    }

    // receiver should be handshaking now (it processed the HELLO)
    // but if we send another HELLO with lower seq, it would be skipped
    // (HELLO is exempt from seq check, so let's test with a different msg type)

    // the receiver is now in Handshaking state — send a bogus AUTH with seq 3 (< 5)
    const replayedAuth = serializeMessage({
      ...createBaseFields(MessageType.AUTH, receiver.id, 3),
      proof: "bogus",
    });

    // this should be silently dropped due to seq <= highestSeenSeq
    const errors: string[] = [];
    receiver.on(SessionEvent.Error, (err) => errors.push(err.message));

    for (const cb of (receiverTransport as any).messageCallbacks) {
      cb(replayedAuth);
    }

    // no error should be emitted because the message was dropped before processing
    expect(errors).toEqual([]);
  });
});

describe("Session expiry", () => {
  it("should report bootstrap not expired immediately after creation", () => {
    const session = new Session(SessionRole.Receiver, {
      deviceName: "R",
      bootstrapTtl: 90,
    });
    expect(session.isBootstrapExpired()).toBe(false);
  });

  it("should report session not expired immediately after creation", () => {
    const session = new Session(SessionRole.Receiver, {
      deviceName: "R",
      sessionTtl: 300,
    });
    expect(session.isSessionExpired()).toBe(false);
  });

  it("should return correct bootstrap TTL", () => {
    const session = new Session(SessionRole.Receiver, {
      deviceName: "R",
      bootstrapTtl: 60,
    });
    expect(session.getBootstrapTtl()).toBe(60);
  });
});
