export type { KeyPair, SharedSecret, EncryptedEnvelope } from "./types.js";

export {
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
} from "./crypto.js";
