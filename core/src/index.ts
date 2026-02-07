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
  PUBLIC_KEY_LENGTH,
  KEY_LENGTH,
  NONCE_LENGTH,
  AEAD_TAG_LENGTH,
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
  DEFAULT_PORT,
  type SessionConfig,
  SessionController,
  type ReceivedItem,
  type SentItem,
  type SessionSnapshot,
  type SnapshotListener,
} from "./session/index.js";

// utils
export {
  discoverReceiver,
  type DiscoveryOptions,
} from "./utils/index.js";

// config
export * from "./config.js";

// strings (legacy — use i18n translations instead)
import * as _strings from "./strings.js";
export { _strings as strings };

// i18n translation resources
export { en, type TranslationResource } from "./i18n/index.js";

// transport
export {
  type ILocalTransport,
  type TransportState,
  type TransportStateCallback,
  type MessageCallback,
  WebSocketTransport,
  MAX_MESSAGE_SIZE,
  type WebSocketServerAdapter,
  type WebSocketClientAdapter,
  type ConnectionHandler,
} from "./transport/index.js";

// branded types
export {
  type SessionId,
  type NetworkAddress,
  type Base64PublicKey,
  type Base64Ciphertext,
  type Base64Nonce,
  type Base64Proof,
  type SequenceNumber,
  asSessionId,
  asNetworkAddress,
  asBase64PublicKey,
  asBase64Ciphertext,
  asBase64Nonce,
  asBase64Proof,
  asSequenceNumber,
} from "./types/index.js";
