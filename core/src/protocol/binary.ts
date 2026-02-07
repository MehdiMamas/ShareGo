/**
 * binary serialization for DATA messages.
 *
 * format: [1-byte type][4-byte sequence][24-byte nonce][N-byte ciphertext]
 *
 * control messages (HELLO, CHALLENGE, AUTH, ACCEPT, REJECT, ACK, CLOSE)
 * remain JSON-over-text-frames for debuggability.
 * DATA messages use this compact binary format to avoid base64 overhead.
 */

import type { SessionId, SequenceNumber, Base64Ciphertext, Base64Nonce } from "../types/index.js";
import { asSequenceNumber } from "../types/index.js";
import { NONCE_LENGTH, AEAD_TAG_LENGTH } from "../crypto/index.js";
import { MAX_MESSAGE_SIZE } from "../config.js";

/** binary message type byte for DATA */
export const BINARY_DATA_TYPE = 0x01;

/** header size: 1 (type) + 4 (seq) + 24 (nonce) = 29 bytes */
export const BINARY_HEADER_SIZE = 1 + 4 + NONCE_LENGTH;

/**
 * binary data message — the deserialized form of a binary DATA frame.
 */
export interface BinaryDataMessage {
  /** always BINARY_DATA_TYPE */
  typeByte: number;
  /** monotonic sequence number */
  seq: SequenceNumber;
  /** 24-byte nonce */
  nonce: Uint8Array;
  /** encrypted ciphertext (includes AEAD tag) */
  ciphertext: Uint8Array;
}

/**
 * serialize a DATA message to compact binary format.
 * avoids base64 encoding overhead (~33% size increase) for encrypted payloads.
 */
export function serializeBinaryData(
  seq: SequenceNumber,
  nonce: Uint8Array,
  ciphertext: Uint8Array,
): Uint8Array {
  if (nonce.length !== NONCE_LENGTH) {
    throw new Error(`invalid nonce length: expected ${NONCE_LENGTH}, got ${nonce.length}`);
  }
  if (ciphertext.length < AEAD_TAG_LENGTH) {
    throw new Error(`ciphertext too short: minimum ${AEAD_TAG_LENGTH} bytes`);
  }

  const totalSize = BINARY_HEADER_SIZE + ciphertext.length;
  if (totalSize > MAX_MESSAGE_SIZE) {
    throw new Error(`binary message too large: ${totalSize} bytes exceeds ${MAX_MESSAGE_SIZE} limit`);
  }

  const buf = new Uint8Array(totalSize);
  const view = new DataView(buf.buffer);

  // type byte
  buf[0] = BINARY_DATA_TYPE;

  // 4-byte big-endian sequence number
  view.setUint32(1, seq as number, false);

  // 24-byte nonce
  buf.set(nonce, 5);

  // ciphertext (remainder)
  buf.set(ciphertext, BINARY_HEADER_SIZE);

  return buf;
}

/**
 * deserialize a binary DATA frame back to its components.
 * throws on invalid format.
 */
export function deserializeBinaryData(data: Uint8Array): BinaryDataMessage {
  if (data.length > MAX_MESSAGE_SIZE) {
    throw new Error(`binary message too large: ${data.length} bytes`);
  }
  if (data.length < BINARY_HEADER_SIZE + AEAD_TAG_LENGTH) {
    throw new Error(
      `binary message too short: ${data.length} bytes (minimum ${BINARY_HEADER_SIZE + AEAD_TAG_LENGTH})`,
    );
  }

  const typeByte = data[0];
  if (typeByte !== BINARY_DATA_TYPE) {
    throw new Error(`unknown binary message type: 0x${typeByte.toString(16)}`);
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const seq = asSequenceNumber(view.getUint32(1, false));

  const nonce = data.slice(5, 5 + NONCE_LENGTH);
  const ciphertext = data.slice(BINARY_HEADER_SIZE);

  return { typeByte, seq, nonce, ciphertext };
}

/**
 * check if a received frame is a binary DATA message.
 * binary DATA messages start with BINARY_DATA_TYPE (0x01).
 * JSON messages start with '{' (0x7B) so there's no ambiguity.
 */
export function isBinaryDataFrame(data: Uint8Array): boolean {
  return data.length > 0 && data[0] === BINARY_DATA_TYPE;
}
