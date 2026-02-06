// crypto
export {
  type KeyPair,
  type SharedSecret,
  type EncryptedEnvelope,
  initCrypto,
  generateKeyPair,
  deriveSharedSecret,
  encrypt,
  decrypt,
  generateSessionId,
  generateNonce,
  zeroMemory,
  toBase64,
  fromBase64,
} from "./crypto/index.js";

// protocol
export {
  PROTOCOL_VERSION,
  MessageType,
  type BaseMessage,
  type HelloMessage,
  type ChallengeMessage,
  type AuthMessage,
  type AcceptMessage,
  type RejectMessage,
  type DataMessage,
  type AckMessage,
  type CloseMessage,
  type ProtocolMessage,
  type QrPayload,
  serializeMessage,
  deserializeMessage,
  encodeQrPayload,
  decodeQrPayload,
  createBaseFields,
} from "./protocol/index.js";

// session
export {
  SessionState,
  SessionRole,
  SessionEvent,
  VALID_TRANSITIONS,
  type SessionEventMap,
  type PairingRequest,
  Session,
  type SessionConfig,
} from "./session/index.js";

// transport
export {
  type ILocalTransport,
  type TransportState,
  type TransportStateCallback,
  type MessageCallback,
  WebSocketTransport,
  type WebSocketServerAdapter,
  type WebSocketClientAdapter,
  type ConnectionHandler,
} from "./transport/index.js";
