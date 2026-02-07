import { describe, it, expect } from "vitest";
import {
  serializeBinaryData,
  deserializeBinaryData,
  isBinaryDataFrame,
  BINARY_DATA_TYPE,
  BINARY_HEADER_SIZE,
} from "./binary.js";
import { asSequenceNumber } from "../types/index.js";
import { NONCE_LENGTH, AEAD_TAG_LENGTH } from "../crypto/index.js";
import { MAX_MESSAGE_SIZE } from "../config.js";

/** create a valid nonce (24 bytes) */
function makeNonce(fill = 0xaa): Uint8Array {
  const nonce = new Uint8Array(NONCE_LENGTH);
  nonce.fill(fill);
  return nonce;
}

/** create a valid ciphertext (at least AEAD_TAG_LENGTH bytes) */
function makeCiphertext(payloadSize = 10): Uint8Array {
  const ct = new Uint8Array(payloadSize + AEAD_TAG_LENGTH);
  for (let i = 0; i < ct.length; i++) ct[i] = i & 0xff;
  return ct;
}

describe("serializeBinaryData", () => {
  it("should produce a buffer with correct header layout", () => {
    const seq = asSequenceNumber(42);
    const nonce = makeNonce();
    const ct = makeCiphertext(5);

    const buf = serializeBinaryData(seq, nonce, ct);

    expect(buf[0]).toBe(BINARY_DATA_TYPE);
    expect(buf.length).toBe(BINARY_HEADER_SIZE + ct.length);

    // check sequence number (big-endian uint32)
    const view = new DataView(buf.buffer);
    expect(view.getUint32(1, false)).toBe(42);

    // check nonce
    expect(Array.from(buf.slice(5, 5 + NONCE_LENGTH))).toEqual(
      Array.from(nonce),
    );

    // check ciphertext
    expect(Array.from(buf.slice(BINARY_HEADER_SIZE))).toEqual(
      Array.from(ct),
    );
  });

  it("should handle sequence number 0", () => {
    const buf = serializeBinaryData(
      asSequenceNumber(0),
      makeNonce(),
      makeCiphertext(),
    );
    const view = new DataView(buf.buffer);
    expect(view.getUint32(1, false)).toBe(0);
  });

  it("should handle max uint32 sequence number", () => {
    const buf = serializeBinaryData(
      asSequenceNumber(0xffffffff),
      makeNonce(),
      makeCiphertext(),
    );
    const view = new DataView(buf.buffer);
    expect(view.getUint32(1, false)).toBe(0xffffffff);
  });

  it("should reject invalid nonce length", () => {
    expect(() =>
      serializeBinaryData(
        asSequenceNumber(1),
        new Uint8Array(10), // wrong length
        makeCiphertext(),
      ),
    ).toThrow("invalid nonce length");
  });

  it("should reject ciphertext shorter than AEAD tag", () => {
    expect(() =>
      serializeBinaryData(
        asSequenceNumber(1),
        makeNonce(),
        new Uint8Array(AEAD_TAG_LENGTH - 1), // too short
      ),
    ).toThrow("ciphertext too short");
  });

  it("should reject messages exceeding MAX_MESSAGE_SIZE", () => {
    const hugeCt = new Uint8Array(MAX_MESSAGE_SIZE); // this + header > MAX_MESSAGE_SIZE
    expect(() =>
      serializeBinaryData(asSequenceNumber(1), makeNonce(), hugeCt),
    ).toThrow("too large");
  });
});

describe("deserializeBinaryData", () => {
  it("should roundtrip with serializeBinaryData", () => {
    const seq = asSequenceNumber(1234);
    const nonce = makeNonce(0xbb);
    const ct = makeCiphertext(20);

    const buf = serializeBinaryData(seq, nonce, ct);
    const result = deserializeBinaryData(buf);

    expect(result.typeByte).toBe(BINARY_DATA_TYPE);
    expect(result.seq).toBe(1234);
    expect(Array.from(result.nonce)).toEqual(Array.from(nonce));
    expect(Array.from(result.ciphertext)).toEqual(Array.from(ct));
  });

  it("should reject too-short buffers", () => {
    const short = new Uint8Array(BINARY_HEADER_SIZE + AEAD_TAG_LENGTH - 1);
    short[0] = BINARY_DATA_TYPE;
    expect(() => deserializeBinaryData(short)).toThrow("too short");
  });

  it("should reject wrong type byte", () => {
    const buf = new Uint8Array(BINARY_HEADER_SIZE + AEAD_TAG_LENGTH);
    buf[0] = 0xff;
    expect(() => deserializeBinaryData(buf)).toThrow("unknown binary message type");
  });

  it("should reject oversized buffers", () => {
    const huge = new Uint8Array(MAX_MESSAGE_SIZE + 1);
    huge[0] = BINARY_DATA_TYPE;
    expect(() => deserializeBinaryData(huge)).toThrow("too large");
  });
});

describe("isBinaryDataFrame", () => {
  it("should detect binary DATA frames", () => {
    const buf = new Uint8Array([BINARY_DATA_TYPE, 0, 0, 0, 0]);
    expect(isBinaryDataFrame(buf)).toBe(true);
  });

  it("should reject empty buffers", () => {
    expect(isBinaryDataFrame(new Uint8Array(0))).toBe(false);
  });

  it("should reject JSON frames (starting with '{')", () => {
    const json = new TextEncoder().encode('{"type":"HELLO"}');
    expect(isBinaryDataFrame(json)).toBe(false);
  });

  it("should reject other type bytes", () => {
    const buf = new Uint8Array([0x02, 0, 0, 0, 0]);
    expect(isBinaryDataFrame(buf)).toBe(false);
  });
});

describe("BINARY_HEADER_SIZE", () => {
  it("should be 1 + 4 + NONCE_LENGTH = 29 bytes", () => {
    expect(BINARY_HEADER_SIZE).toBe(1 + 4 + NONCE_LENGTH);
    expect(BINARY_HEADER_SIZE).toBe(29);
  });
});
