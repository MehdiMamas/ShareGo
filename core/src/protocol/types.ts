/**
 * protocol version — bump on breaking wire format changes.
 */
export const PROTOCOL_VERSION = 1;

/**
 * all message types in the ShareGo protocol.
 */
export enum MessageType {
  /** sender initiates handshake with its public key */
  HELLO = "HELLO",
  /** receiver responds with a nonce challenge */
  CHALLENGE = "CHALLENGE",
  /** sender proves possession of its key by signing the challenge */
  AUTH = "AUTH",
  /** receiver accepts the pairing */
  ACCEPT = "ACCEPT",
  /** receiver rejects the pairing */
  REJECT = "REJECT",
  /** encrypted data payload (password, otp, text) */
  DATA = "DATA",
  /** delivery acknowledgement */
  ACK = "ACK",
  /** session teardown */
  CLOSE = "CLOSE",
}

/**
 * base message envelope — every message has these fields.
 */
export interface BaseMessage {
  /** protocol version */
  v: number;
  /** message type */
  type: MessageType;
  /** session id */
  sid: string;
  /** monotonic sequence number (for ordering and replay detection) */
  seq: number;
}

/** sender -> receiver: start handshake */
export interface HelloMessage extends BaseMessage {
  type: MessageType.HELLO;
  /** sender's ephemeral public key (base64) */
  pk: string;
  /** sender's device name (for display in approval prompt) */
  deviceName: string;
}

/** receiver -> sender: nonce challenge */
export interface ChallengeMessage extends BaseMessage {
  type: MessageType.CHALLENGE;
  /** random nonce (base64) the sender must sign */
  nonce: string;
  /** receiver's ephemeral public key (base64) */
  pk: string;
}

/** sender -> receiver: proof of key possession */
export interface AuthMessage extends BaseMessage {
  type: MessageType.AUTH;
  /** the challenge nonce encrypted with the derived shared key (proves possession) */
  proof: string;
}

/** receiver -> sender: pairing accepted */
export interface AcceptMessage extends BaseMessage {
  type: MessageType.ACCEPT;
}

/** receiver -> sender: pairing rejected */
export interface RejectMessage extends BaseMessage {
  type: MessageType.REJECT;
  /** optional reason for rejection */
  reason?: string;
}

/** encrypted data payload */
export interface DataMessage extends BaseMessage {
  type: MessageType.DATA;
  /** encrypted ciphertext (base64) */
  ciphertext: string;
  /** nonce used for encryption (base64) */
  nonce: string;
}

/** delivery acknowledgement */
export interface AckMessage extends BaseMessage {
  type: MessageType.ACK;
  /** seq number of the DATA message being acknowledged */
  ackSeq: number;
}

/** session teardown */
export interface CloseMessage extends BaseMessage {
  type: MessageType.CLOSE;
}

/** union of all protocol messages */
export type ProtocolMessage =
  | HelloMessage
  | ChallengeMessage
  | AuthMessage
  | AcceptMessage
  | RejectMessage
  | DataMessage
  | AckMessage
  | CloseMessage;

/**
 * QR payload schema — used for Mode 1 (phone scans laptop QR).
 * this is NOT a protocol message; it's the bootstrap payload.
 */
export interface QrPayload {
  /** protocol version */
  v: number;
  /** session id */
  sid: string;
  /** receiver's LAN address (ip:port) */
  addr: string;
  /** receiver's ephemeral public key (base64) */
  pk: string;
  /** expiry in seconds from creation */
  exp: number;
}
