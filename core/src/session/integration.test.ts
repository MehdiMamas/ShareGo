import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { SessionController } from "./session-controller.js";
import type { SessionSnapshot } from "./session-controller.js";
import { SessionState } from "./types.js";
import { initCrypto } from "../crypto/index.js";
import { DEFAULT_PORT } from "../config.js";
import type {
  ILocalTransport,
  TransportState,
  TransportStateCallback,
  MessageCallback,
} from "../transport/types.js";

/** in-memory transport that cross-links two sides for integration testing */
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
    if (this.peer) {
      for (const cb of this.peer.messageCallbacks) {
        cb(data);
      }
    }
  }

  onMessage(cb: MessageCallback): void {
    this.messageCallbacks.push(cb);
  }

  offMessage(cb: MessageCallback): void {
    const idx = this.messageCallbacks.indexOf(cb);
    if (idx !== -1) this.messageCallbacks.splice(idx, 1);
  }

  onStateChange(cb: TransportStateCallback): void {
    this.stateCallbacks.push(cb);
  }

  offStateChange(cb: TransportStateCallback): void {
    const idx = this.stateCallbacks.indexOf(cb);
    if (idx !== -1) this.stateCallbacks.splice(idx, 1);
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

  simulateConnection(): void {
    this.state = "connected";
    for (const cb of this.stateCallbacks) cb("connected");
  }
}

beforeAll(async () => {
  await initCrypto();
});

describe("SessionController integration — full flow", () => {
  let receiverCtrl: SessionController;
  let senderCtrl: SessionController;
  let receiverTransport: MockTransport;
  let senderTransport: MockTransport;

  beforeEach(() => {
    receiverCtrl = new SessionController();
    senderCtrl = new SessionController();
    receiverTransport = new MockTransport();
    senderTransport = new MockTransport();

    receiverTransport.peer = senderTransport;
    senderTransport.peer = receiverTransport;
  });

  afterEach(() => {
    receiverCtrl.destroy();
    senderCtrl.destroy();
  });

  it("should complete full flow: start → connect → approve → exchange data → end", async () => {
    await receiverCtrl.startReceiver(receiverTransport, {
      deviceName: "Receiver",
      port: DEFAULT_PORT,
      bootstrapTtl: 90,
    });

    const sid = receiverCtrl.getSnapshot().sessionId;
    expect(sid).toHaveLength(6);
    expect(receiverCtrl.getSnapshot().state).toBe(SessionState.WaitingForSender);

    receiverTransport.simulateConnection();

    await senderCtrl.startSender(
      senderTransport,
      { deviceName: "Sender" },
      "127.0.0.1:4040",
      undefined,
      sid!,
    );

    // receiver should be pending approval after handshake
    expect(receiverCtrl.getSnapshot().state).toBe(SessionState.PendingApproval);
    expect(receiverCtrl.getSnapshot().pairingRequest).not.toBeNull();
    expect(receiverCtrl.getSnapshot().pairingRequest!.deviceName).toBe("Sender");

    // approve
    receiverCtrl.approve();
    expect(receiverCtrl.getSnapshot().state).toBe(SessionState.Active);
    expect(senderCtrl.getSnapshot().state).toBe(SessionState.Active);

    // sender sends data
    senderCtrl.sendData("password123");
    expect(senderCtrl.getSnapshot().sentItems).toHaveLength(1);
    expect(senderCtrl.getSnapshot().sentItems[0].text).toBe("password123");

    // receiver gets data
    expect(receiverCtrl.getSnapshot().receivedItems).toHaveLength(1);
    expect(receiverCtrl.getSnapshot().receivedItems[0].text).toBe("password123");

    // receiver sends data back
    receiverCtrl.sendData("otp-456789");
    expect(receiverCtrl.getSnapshot().sentItems).toHaveLength(1);
    expect(receiverCtrl.getSnapshot().sentItems[0].text).toBe("otp-456789");

    // sender gets data
    expect(senderCtrl.getSnapshot().receivedItems).toHaveLength(1);
    expect(senderCtrl.getSnapshot().receivedItems[0].text).toBe("otp-456789");

    // end session
    receiverCtrl.endSession();
    expect(receiverCtrl.getSnapshot().state).toBe(SessionState.Closed);
  });

  it("should handle rejection through controller", async () => {
    await receiverCtrl.startReceiver(receiverTransport, {
      deviceName: "Receiver",
      port: DEFAULT_PORT,
      bootstrapTtl: 90,
    });

    const sid = receiverCtrl.getSnapshot().sessionId!;
    receiverTransport.simulateConnection();

    await senderCtrl.startSender(
      senderTransport,
      { deviceName: "Sender" },
      "127.0.0.1:4040",
      undefined,
      sid,
    );

    expect(receiverCtrl.getSnapshot().state).toBe(SessionState.PendingApproval);

    // reject
    receiverCtrl.reject("not allowed");
    expect(receiverCtrl.getSnapshot().state).toBe(SessionState.Rejected);
    expect(senderCtrl.getSnapshot().state).toBe(SessionState.Rejected);
    expect(receiverCtrl.getSnapshot().pairingRequest).toBeNull();
  });

  it("should exchange multiple messages in sequence", async () => {
    await receiverCtrl.startReceiver(receiverTransport, {
      deviceName: "Receiver",
      port: DEFAULT_PORT,
      bootstrapTtl: 90,
    });

    const sid = receiverCtrl.getSnapshot().sessionId!;
    receiverTransport.simulateConnection();

    await senderCtrl.startSender(
      senderTransport,
      { deviceName: "Sender" },
      "127.0.0.1:4040",
      undefined,
      sid,
    );

    receiverCtrl.approve();

    // send multiple messages
    senderCtrl.sendData("first");
    senderCtrl.sendData("second");
    senderCtrl.sendData("third");

    expect(receiverCtrl.getSnapshot().receivedItems).toHaveLength(3);
    expect(receiverCtrl.getSnapshot().receivedItems[0].text).toBe("first");
    expect(receiverCtrl.getSnapshot().receivedItems[1].text).toBe("second");
    expect(receiverCtrl.getSnapshot().receivedItems[2].text).toBe("third");

    // all messages tracked by sender
    expect(senderCtrl.getSnapshot().sentItems).toHaveLength(3);
    expect(senderCtrl.getSnapshot().sentItems[0].text).toBe("first");
    expect(senderCtrl.getSnapshot().sentItems[1].text).toBe("second");
    expect(senderCtrl.getSnapshot().sentItems[2].text).toBe("third");
  });

  it("should notify subscribers of snapshot changes throughout the flow", async () => {
    const snapshots: SessionSnapshot[] = [];
    receiverCtrl.subscribe((snap) => snapshots.push({ ...snap }));

    await receiverCtrl.startReceiver(receiverTransport, {
      deviceName: "Receiver",
      port: DEFAULT_PORT,
      bootstrapTtl: 90,
    });

    receiverTransport.simulateConnection();

    const sid = receiverCtrl.getSnapshot().sessionId!;
    await senderCtrl.startSender(
      senderTransport,
      { deviceName: "Sender" },
      "127.0.0.1:4040",
      undefined,
      sid,
    );

    receiverCtrl.approve();
    senderCtrl.sendData("secret");
    receiverCtrl.endSession();

    // verify we got snapshots for the major state transitions
    const states = snapshots.map((s) => s.state);
    expect(states).toContain(SessionState.Created);
    expect(states).toContain(SessionState.WaitingForSender);
    expect(states).toContain(SessionState.Handshaking);
    expect(states).toContain(SessionState.PendingApproval);
    expect(states).toContain(SessionState.Active);
    expect(states).toContain(SessionState.Closed);

    // verify data was captured in snapshots
    const withData = snapshots.filter((s) => s.receivedItems.length > 0);
    expect(withData.length).toBeGreaterThan(0);
    expect(withData[0].receivedItems[0].text).toBe("secret");
  });

  it("should clean up state after endSession", async () => {
    await receiverCtrl.startReceiver(receiverTransport, {
      deviceName: "Receiver",
      port: DEFAULT_PORT,
      bootstrapTtl: 90,
    });

    const sid = receiverCtrl.getSnapshot().sessionId!;
    receiverTransport.simulateConnection();

    await senderCtrl.startSender(
      senderTransport,
      { deviceName: "Sender" },
      "127.0.0.1:4040",
      undefined,
      sid,
    );

    receiverCtrl.approve();
    senderCtrl.sendData("data");

    // verify data exists before cleanup
    expect(receiverCtrl.getSnapshot().receivedItems).toHaveLength(1);

    receiverCtrl.endSession();

    const snap = receiverCtrl.getSnapshot();
    expect(snap.state).toBe(SessionState.Closed);
    expect(snap.sessionId).toBeNull();
    expect(snap.qrPayload).toBeNull();
    expect(snap.localAddress).toBeNull();
    expect(snap.pairingRequest).toBeNull();
    expect(snap.receivedItems).toHaveLength(0);
    expect(snap.sentItems).toHaveLength(0);
    expect(snap.error).toBeNull();
  });

  it("should support bidirectional exchange in alternating order", async () => {
    await receiverCtrl.startReceiver(receiverTransport, {
      deviceName: "Receiver",
      port: DEFAULT_PORT,
      bootstrapTtl: 90,
    });

    const sid = receiverCtrl.getSnapshot().sessionId!;
    receiverTransport.simulateConnection();

    await senderCtrl.startSender(
      senderTransport,
      { deviceName: "Sender" },
      "127.0.0.1:4040",
      undefined,
      sid,
    );

    receiverCtrl.approve();

    // alternate sending
    senderCtrl.sendData("from-sender-1");
    receiverCtrl.sendData("from-receiver-1");
    senderCtrl.sendData("from-sender-2");
    receiverCtrl.sendData("from-receiver-2");

    // verify receiver got sender's messages
    const receiverItems = receiverCtrl.getSnapshot().receivedItems;
    expect(receiverItems).toHaveLength(2);
    expect(receiverItems[0].text).toBe("from-sender-1");
    expect(receiverItems[1].text).toBe("from-sender-2");

    // verify sender got receiver's messages
    const senderItems = senderCtrl.getSnapshot().receivedItems;
    expect(senderItems).toHaveLength(2);
    expect(senderItems[0].text).toBe("from-receiver-1");
    expect(senderItems[1].text).toBe("from-receiver-2");
  });

  it("should start a new session after ending the previous one", async () => {
    // first session
    await receiverCtrl.startReceiver(receiverTransport, {
      deviceName: "Receiver",
      port: DEFAULT_PORT,
      bootstrapTtl: 90,
    });

    const firstSid = receiverCtrl.getSnapshot().sessionId;
    receiverCtrl.endSession();
    expect(receiverCtrl.getSnapshot().state).toBe(SessionState.Closed);

    // second session with fresh transport
    const newTransport = new MockTransport();
    await receiverCtrl.startReceiver(newTransport, {
      deviceName: "Receiver",
      port: DEFAULT_PORT,
      bootstrapTtl: 90,
    });

    const secondSid = receiverCtrl.getSnapshot().sessionId;
    expect(secondSid).toHaveLength(6);
    expect(secondSid).not.toBe(firstSid);
    expect(receiverCtrl.getSnapshot().state).toBe(SessionState.WaitingForSender);
  });

  it("should throw when sendData is called before session is active", async () => {
    await receiverCtrl.startReceiver(receiverTransport, {
      deviceName: "Receiver",
      port: DEFAULT_PORT,
      bootstrapTtl: 90,
    });

    // session is in WaitingForSender — sendData should throw
    expect(() => receiverCtrl.sendData("test")).toThrow("expected state Active");
    expect(receiverCtrl.getSnapshot().sentItems).toHaveLength(0);
  });

  it("should silently skip sendData when no session exists", () => {
    // no session started — sendData should return without error
    const freshCtrl = new SessionController();
    expect(() => freshCtrl.sendData("test")).not.toThrow();
    expect(freshCtrl.getSnapshot().sentItems).toHaveLength(0);
    freshCtrl.destroy();
  });

  it("should set qrPayload and localAddress on receiver start", async () => {
    await receiverCtrl.startReceiver(receiverTransport, {
      deviceName: "Receiver",
      port: DEFAULT_PORT,
      bootstrapTtl: 90,
    });

    const snap = receiverCtrl.getSnapshot();
    expect(snap.localAddress).toBe("127.0.0.1:4040");
    expect(snap.qrPayload).not.toBeNull();
    expect(snap.qrPayload!.length).toBeGreaterThan(0);
  });
});
