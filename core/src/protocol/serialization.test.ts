import { describe, it, expect } from "vitest";
import {
  serializeMessage,
  deserializeMessage,
  encodeQrPayload,
  decodeQrPayload,
  createBaseFields,
} from "./serialization.js";
import { MessageType, PROTOCOL_VERSION } from "./types.js";

describe("serializeMessage / deserializeMessage", () => {
  it("should roundtrip a HELLO message", () => {
    const msg = {
      ...createBaseFields(MessageType.HELLO, "ABC123", 1),
      pk: "somepublickey",
      deviceName: "Test Device",
    };
    const bytes = serializeMessage(msg);
    const result = deserializeMessage(bytes);
    expect(result).toEqual(msg);
  });

  it("should roundtrip a CHALLENGE message", () => {
    const msg = {
      ...createBaseFields(MessageType.CHALLENGE, "ABC123", 2),
      nonce: "somenonce",
      pk: "receiverpk",
    };
    const bytes = serializeMessage(msg);
    const result = deserializeMessage(bytes);
    expect(result).toEqual(msg);
  });

  it("should roundtrip an AUTH message", () => {
    const msg = {
      ...createBaseFields(MessageType.AUTH, "ABC123", 3),
      proof: "someproof",
    };
    const bytes = serializeMessage(msg);
    const result = deserializeMessage(bytes);
    expect(result).toEqual(msg);
  });

  it("should roundtrip an ACCEPT message", () => {
    const msg = createBaseFields(MessageType.ACCEPT, "ABC123", 4);
    const bytes = serializeMessage(msg);
    const result = deserializeMessage(bytes);
    expect(result).toEqual(msg);
  });

  it("should roundtrip a REJECT message", () => {
    const msg = {
      ...createBaseFields(MessageType.REJECT, "ABC123", 5),
      reason: "user rejected",
    };
    const bytes = serializeMessage(msg);
    const result = deserializeMessage(bytes);
    expect(result).toEqual(msg);
  });

  it("should roundtrip a DATA message", () => {
    const msg = {
      ...createBaseFields(MessageType.DATA, "ABC123", 6),
      ciphertext: "encrypted",
      nonce: "datanonce",
    };
    const bytes = serializeMessage(msg);
    const result = deserializeMessage(bytes);
    expect(result).toEqual(msg);
  });

  it("should roundtrip an ACK message", () => {
    const msg = {
      ...createBaseFields(MessageType.ACK, "ABC123", 7),
      ackSeq: 6,
    };
    const bytes = serializeMessage(msg);
    const result = deserializeMessage(bytes);
    expect(result).toEqual(msg);
  });

  it("should roundtrip a CLOSE message", () => {
    const msg = createBaseFields(MessageType.CLOSE, "ABC123", 8);
    const bytes = serializeMessage(msg);
    const result = deserializeMessage(bytes);
    expect(result).toEqual(msg);
  });
});

describe("deserializeMessage validation", () => {
  function makeBytes(obj: unknown): Uint8Array {
    return new TextEncoder().encode(JSON.stringify(obj));
  }

  it("should reject invalid JSON", () => {
    expect(() =>
      deserializeMessage(new TextEncoder().encode("not json")),
    ).toThrow();
  });

  it("should reject wrong protocol version", () => {
    expect(() =>
      deserializeMessage(
        makeBytes({ v: 999, type: "HELLO", sid: "X", seq: 1, pk: "k", deviceName: "d" }),
      ),
    ).toThrow("unsupported protocol version");
  });

  it("should reject unknown message type", () => {
    expect(() =>
      deserializeMessage(
        makeBytes({ v: PROTOCOL_VERSION, type: "UNKNOWN", sid: "X", seq: 1 }),
      ),
    ).toThrow("unknown message type");
  });

  it("should reject missing session id", () => {
    expect(() =>
      deserializeMessage(
        makeBytes({ v: PROTOCOL_VERSION, type: "HELLO", seq: 1, pk: "k", deviceName: "d" }),
      ),
    ).toThrow("missing or invalid session id");
  });

  it("should reject missing sequence number", () => {
    expect(() =>
      deserializeMessage(
        makeBytes({ v: PROTOCOL_VERSION, type: "HELLO", sid: "X", pk: "k", deviceName: "d" }),
      ),
    ).toThrow("missing or invalid sequence number");
  });

  it("should reject HELLO without public key", () => {
    expect(() =>
      deserializeMessage(
        makeBytes({ v: PROTOCOL_VERSION, type: "HELLO", sid: "X", seq: 1, deviceName: "d" }),
      ),
    ).toThrow("HELLO: public key: missing");
  });

  it("should reject HELLO without device name", () => {
    expect(() =>
      deserializeMessage(
        makeBytes({ v: PROTOCOL_VERSION, type: "HELLO", sid: "X", seq: 1, pk: "k" }),
      ),
    ).toThrow("HELLO: missing device name");
  });

  it("should reject CHALLENGE without nonce", () => {
    expect(() =>
      deserializeMessage(
        makeBytes({ v: PROTOCOL_VERSION, type: "CHALLENGE", sid: "X", seq: 1, pk: "k" }),
      ),
    ).toThrow("CHALLENGE: nonce: missing");
  });

  it("should reject AUTH without proof", () => {
    expect(() =>
      deserializeMessage(
        makeBytes({ v: PROTOCOL_VERSION, type: "AUTH", sid: "X", seq: 1 }),
      ),
    ).toThrow("AUTH: proof: missing");
  });

  it("should reject DATA without ciphertext", () => {
    expect(() =>
      deserializeMessage(
        makeBytes({ v: PROTOCOL_VERSION, type: "DATA", sid: "X", seq: 1, nonce: "n" }),
      ),
    ).toThrow("DATA: ciphertext: missing");
  });

  it("should reject DATA without nonce", () => {
    expect(() =>
      deserializeMessage(
        makeBytes({ v: PROTOCOL_VERSION, type: "DATA", sid: "X", seq: 1, ciphertext: "c" }),
      ),
    ).toThrow("DATA: nonce: missing");
  });

  it("should reject ACK without ackSeq", () => {
    expect(() =>
      deserializeMessage(
        makeBytes({ v: PROTOCOL_VERSION, type: "ACK", sid: "X", seq: 1 }),
      ),
    ).toThrow("ACK: missing or invalid ackSeq");
  });
});

describe("createBaseFields", () => {
  it("should create fields with correct protocol version", () => {
    const fields = createBaseFields(MessageType.HELLO, "TEST", 42);
    expect(fields.v).toBe(PROTOCOL_VERSION);
    expect(fields.type).toBe(MessageType.HELLO);
    expect(fields.sid).toBe("TEST");
    expect(fields.seq).toBe(42);
  });
});

describe("encodeQrPayload / decodeQrPayload", () => {
  it("should roundtrip a valid payload", () => {
    const payload = {
      v: PROTOCOL_VERSION,
      sid: "ABC123",
      addr: "192.168.1.100:4040",
      pk: "somepublickey",
      exp: 90,
    };
    const encoded = encodeQrPayload(payload);
    const decoded = decodeQrPayload(encoded);
    expect(decoded).toEqual(payload);
  });

  it("should reject wrong version", () => {
    const encoded = JSON.stringify({
      v: 999,
      sid: "X",
      addr: "1.1.1.1:80",
      pk: "k",
      exp: 10,
    });
    expect(() => decodeQrPayload(encoded)).toThrow("unsupported QR version");
  });

  it("should reject missing session id", () => {
    const encoded = JSON.stringify({
      v: PROTOCOL_VERSION,
      addr: "1.1.1.1:80",
      pk: "k",
      exp: 10,
    });
    expect(() => decodeQrPayload(encoded)).toThrow("missing session id");
  });

  it("should reject missing address", () => {
    const encoded = JSON.stringify({
      v: PROTOCOL_VERSION,
      sid: "X",
      pk: "k",
      exp: 10,
    });
    expect(() => decodeQrPayload(encoded)).toThrow("missing address");
  });

  it("should reject missing public key", () => {
    const encoded = JSON.stringify({
      v: PROTOCOL_VERSION,
      sid: "X",
      addr: "1.1.1.1:80",
      exp: 10,
    });
    expect(() => decodeQrPayload(encoded)).toThrow("missing public key");
  });

  it("should reject missing or invalid expiry", () => {
    const encoded = JSON.stringify({
      v: PROTOCOL_VERSION,
      sid: "X",
      addr: "1.1.1.1:80",
      pk: "k",
    });
    expect(() => decodeQrPayload(encoded)).toThrow("missing or invalid expiry");
  });

  it("should reject invalid JSON", () => {
    expect(() => decodeQrPayload("not json")).toThrow();
  });
});
