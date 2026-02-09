import { type ProtocolMessage, type QrPayload, MessageType, PROTOCOL_VERSION } from "./types.js";
import type { SessionId, SequenceNumber } from "../types/index.js";
import { asSessionId, asSequenceNumber } from "../types/index.js";
import { MAX_MESSAGE_SIZE, MAX_BASE64_FIELD_LENGTH, MAX_DEVICE_NAME_LENGTH } from "../config.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * serialize a protocol message to bytes for transport.
 * format: UTF-8 JSON. simple, debuggable, and small for text payloads.
 */
export function serializeMessage(msg: ProtocolMessage): Uint8Array {
  return encoder.encode(JSON.stringify(msg));
}

/** guard for base64-encoded string fields */
function assertBase64Field(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string" || !value) {
    throw new Error(`${name}: missing`);
  }
  if (value.length > MAX_BASE64_FIELD_LENGTH) {
    throw new Error(`${name}: exceeds maximum length`);
  }
}

/**
 * deserialize bytes from transport back into a protocol message.
 * throws on invalid JSON or missing required fields.
 */
export function deserializeMessage(data: Uint8Array): ProtocolMessage {
  if (data.length > MAX_MESSAGE_SIZE) {
    throw new Error(`message too large: ${data.length} bytes`);
  }

  const text = decoder.decode(data);
  const parsed = JSON.parse(text);

  if (!parsed || typeof parsed !== "object") {
    throw new Error("invalid message: not an object");
  }
  if (parsed.v !== PROTOCOL_VERSION) {
    throw new Error(`unsupported protocol version: ${parsed.v} (expected ${PROTOCOL_VERSION})`);
  }
  if (!parsed.type || !Object.values(MessageType).includes(parsed.type)) {
    throw new Error(`unknown message type: ${parsed.type}`);
  }
  if (!parsed.sid || typeof parsed.sid !== "string") {
    throw new Error("missing or invalid session id");
  }
  if (
    typeof parsed.seq !== "number" ||
    !Number.isFinite(parsed.seq) ||
    parsed.seq < 0 ||
    parsed.seq > 0xffffffff
  ) {
    throw new Error("missing or invalid sequence number");
  }

  // brand boundary values at the deserialization boundary
  parsed.sid = asSessionId(parsed.sid);
  parsed.seq = asSequenceNumber(Math.floor(parsed.seq));

  // validate type-specific required fields with length checks
  switch (parsed.type) {
    case MessageType.HELLO:
      assertBase64Field(parsed.pk, "HELLO: public key");
      if (typeof parsed.deviceName !== "string") {
        throw new Error("HELLO: missing device name");
      }
      if (parsed.deviceName.length > MAX_DEVICE_NAME_LENGTH) {
        throw new Error("HELLO: device name too long");
      }
      break;
    case MessageType.CHALLENGE:
      assertBase64Field(parsed.nonce, "CHALLENGE: nonce");
      assertBase64Field(parsed.pk, "CHALLENGE: public key");
      break;
    case MessageType.AUTH:
      assertBase64Field(parsed.proof, "AUTH: proof");
      break;
    case MessageType.DATA:
      assertBase64Field(parsed.ciphertext, "DATA: ciphertext");
      assertBase64Field(parsed.nonce, "DATA: nonce");
      break;
    case MessageType.ACK:
      if (
        typeof parsed.ackSeq !== "number" ||
        parsed.ackSeq < 0 ||
        !Number.isFinite(parsed.ackSeq)
      ) {
        throw new Error("ACK: missing or invalid ackSeq");
      }
      parsed.ackSeq = asSequenceNumber(parsed.ackSeq);
      break;
  }

  return parsed as ProtocolMessage;
}

/**
 * encode a QR payload to a compact JSON string (for embedding in QR code).
 */
export function encodeQrPayload(payload: QrPayload): string {
  return JSON.stringify(payload);
}

/**
 * decode a QR payload string back to structured data.
 * throws on invalid format.
 */
export function decodeQrPayload(raw: string): QrPayload {
  const parsed = JSON.parse(raw);

  if (!parsed || typeof parsed !== "object") {
    throw new Error("invalid QR payload: not an object");
  }
  if (parsed.v !== PROTOCOL_VERSION) {
    throw new Error(`unsupported QR version: ${parsed.v} (expected ${PROTOCOL_VERSION})`);
  }
  if (!parsed.sid || typeof parsed.sid !== "string") {
    throw new Error("missing session id in QR payload");
  }
  if (!parsed.addr || typeof parsed.addr !== "string") {
    throw new Error("missing address in QR payload");
  }
  if (!parsed.pk || typeof parsed.pk !== "string") {
    throw new Error("missing public key in QR payload");
  }
  if (typeof parsed.exp !== "number" || parsed.exp <= 0) {
    throw new Error("missing or invalid expiry in QR payload");
  }

  return parsed as QrPayload;
}

/**
 * helper to create a base message with common fields filled in.
 * preserves the literal message type for type safety.
 */
export function createBaseFields<T extends MessageType>(
  type: T,
  sid: SessionId,
  seq: SequenceNumber,
): { v: number; type: T; sid: SessionId; seq: SequenceNumber } {
  return {
    v: PROTOCOL_VERSION,
    type,
    sid,
    seq,
  };
}
