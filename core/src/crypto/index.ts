export type { KeyPair, SharedSecret, EncryptedEnvelope } from "./types.js";

export {
  initCrypto,
  ensureReady,
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
  constantTimeEqual,
} from "./crypto.js";
