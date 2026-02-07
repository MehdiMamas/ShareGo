import {
  type ProtocolMessage,
  type QrPayload,
  MessageType,
  PROTOCOL_VERSION,
} from "./types.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * serialize a protocol message to bytes for transport.
 * format: UTF-8 JSON. simple, debuggable, and small for text payloads.
 */
export function serializeMessage(msg: ProtocolMessage): Uint8Array {
  return encoder.encode(JSON.stringify(msg));
}

/**
 * deserialize bytes from transport back into a protocol message.
 * throws on invalid JSON or missing required fields.
 */
export function deserializeMessage(data: Uint8Array): ProtocolMessage {
  const text = decoder.decode(data);
  const parsed = JSON.parse(text);

  if (!parsed || typeof parsed !== "object") {
    throw new Error("invalid message: not an object");
  }
  if (parsed.v !== PROTOCOL_VERSION) {
    throw new Error(
      `unsupported protocol version: ${parsed.v} (expected ${PROTOCOL_VERSION})`,
    );
  }
  if (!parsed.type || !Object.values(MessageType).includes(parsed.type)) {
    throw new Error(`unknown message type: ${parsed.type}`);
  }
  if (!parsed.sid || typeof parsed.sid !== "string") {
    throw new Error("missing or invalid session id");
  }
  if (typeof parsed.seq !== "number") {
    throw new Error("missing or invalid sequence number");
  }

  // validate type-specific required fields
  switch (parsed.type) {
    case MessageType.HELLO:
      if (typeof parsed.pk !== "string" || !parsed.pk) {
        throw new Error("HELLO: missing public key");
      }
      if (typeof parsed.deviceName !== "string") {
        throw new Error("HELLO: missing device name");
      }
      break;
    case MessageType.CHALLENGE:
      if (typeof parsed.nonce !== "string" || !parsed.nonce) {
        throw new Error("CHALLENGE: missing nonce");
      }
      if (typeof parsed.pk !== "string" || !parsed.pk) {
        throw new Error("CHALLENGE: missing public key");
      }
      break;
    case MessageType.AUTH:
      if (typeof parsed.proof !== "string" || !parsed.proof) {
        throw new Error("AUTH: missing proof");
      }
      break;
    case MessageType.DATA:
      if (typeof parsed.ciphertext !== "string" || !parsed.ciphertext) {
        throw new Error("DATA: missing ciphertext");
      }
      if (typeof parsed.nonce !== "string" || !parsed.nonce) {
        throw new Error("DATA: missing nonce");
      }
      break;
    case MessageType.ACK:
      if (typeof parsed.ackSeq !== "number") {
        throw new Error("ACK: missing ackSeq");
      }
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
    throw new Error(
      `unsupported QR version: ${parsed.v} (expected ${PROTOCOL_VERSION})`,
    );
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
  sid: string,
  seq: number,
): { v: number; type: T; sid: string; seq: number } {
  return {
    v: PROTOCOL_VERSION,
    type,
    sid,
    seq,
  };
}
