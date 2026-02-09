import sodium from "libsodium-wrappers-sumo";
import type { KeyPair, SharedSecret, EncryptedEnvelope } from "./types.js";

let initialized = false;
let initPromise: Promise<void> | null = null;

/** ensure libsodium is ready before any crypto operation */
export function initCrypto(): Promise<void> {
  if (!initPromise) {
    initPromise = sodium.ready.then(() => {
      initialized = true;
    });
  }
  return initPromise;
}

/**
 * await crypto readiness. safe to call concurrently — returns the
 * same promise as initCrypto(). use this instead of assertReady()
 * in async contexts to avoid race conditions.
 */
export async function ensureReady(): Promise<void> {
  if (initialized) return;
  if (initPromise) {
    await initPromise;
    return;
  }
  await initCrypto();
}

/**
 * generate an ephemeral X25519 key pair.
 * must be called once per session — never reuse across sessions.
 */
export function generateKeyPair(): KeyPair {
  assertReady();
  const kp = sodium.crypto_kx_keypair();
  return {
    publicKey: kp.publicKey,
    secretKey: kp.privateKey,
  };
}

/**
 * derive a shared secret from our secret key and their public key.
 * uses libsodium key exchange (X25519 + BLAKE2b).
 *
 * @param isReceiver - true if we are the session receiver (listener)
 */
export function deriveSharedSecret(
  ourKeyPair: KeyPair,
  theirPublicKey: Uint8Array,
  isReceiver: boolean,
): SharedSecret {
  assertReady();

  if (theirPublicKey.length !== PUBLIC_KEY_LENGTH) {
    throw new Error(
      `invalid public key length: expected ${PUBLIC_KEY_LENGTH}, got ${theirPublicKey.length}`,
    );
  }

  try {
    // libsodium kx produces rx and tx keys depending on role
    const sessionKeys = isReceiver
      ? sodium.crypto_kx_server_session_keys(
          ourKeyPair.publicKey,
          ourKeyPair.secretKey,
          theirPublicKey,
        )
      : sodium.crypto_kx_client_session_keys(
          ourKeyPair.publicKey,
          ourKeyPair.secretKey,
          theirPublicKey,
        );

    // use the rx key as symmetric encryption key (both sides derive same key)
    // receiver's rx = sender's tx, so we pick a consistent one
    const encryptionKey = isReceiver ? sessionKeys.sharedRx : sessionKeys.sharedTx;

    return { encryptionKey };
  } catch (err) {
    throw new Error(`key exchange failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * encrypt plaintext using XChaCha20-Poly1305 (AEAD).
 * generates a random 24-byte nonce per message — never reuse.
 */
export function encrypt(plaintext: Uint8Array, key: Uint8Array): EncryptedEnvelope {
  assertReady();

  if (key.length !== KEY_LENGTH) {
    throw new Error(`invalid encryption key length: expected ${KEY_LENGTH}, got ${key.length}`);
  }

  try {
    const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
    const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      plaintext,
      null, // no additional data
      null, // secret nonce (unused in ietf variant)
      nonce,
      key,
    );
    return { ciphertext, nonce };
  } catch (err) {
    throw new Error(`encryption failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * decrypt ciphertext using XChaCha20-Poly1305 (AEAD).
 * throws if authentication fails (tampered or wrong key).
 */
export function decrypt(envelope: EncryptedEnvelope, key: Uint8Array): Uint8Array {
  assertReady();

  if (key.length !== KEY_LENGTH) {
    throw new Error(`invalid decryption key length: expected ${KEY_LENGTH}, got ${key.length}`);
  }
  if (envelope.nonce.length !== NONCE_LENGTH) {
    throw new Error(`invalid nonce length: expected ${NONCE_LENGTH}, got ${envelope.nonce.length}`);
  }
  if (envelope.ciphertext.length < AEAD_TAG_LENGTH) {
    throw new Error(
      `ciphertext too short: minimum ${AEAD_TAG_LENGTH} bytes (AEAD tag), got ${envelope.ciphertext.length}`,
    );
  }

  try {
    return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null, // secret nonce (unused in ietf variant)
      envelope.ciphertext,
      null, // no additional data
      envelope.nonce,
      key,
    );
  } catch (err) {
    throw new Error(`decryption failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * generate a random session id (6-char alphanumeric, uppercase).
 * used for manual pairing mode and QR payload.
 */
export function generateSessionId(): string {
  assertReady();
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion
  const bytes = sodium.randombytes_buf(6);
  let id = "";
  for (let i = 0; i < 6; i++) {
    id += chars[bytes[i] % chars.length];
  }
  return id;
}

/**
 * generate a random nonce for challenge-response auth.
 * returns 32 random bytes.
 */
export function generateNonce(): Uint8Array {
  assertReady();
  return sodium.randombytes_buf(32);
}

/** expected length of an X25519 public key in bytes */
export const PUBLIC_KEY_LENGTH = 32; // crypto_kx_PUBLICKEYBYTES

/** xchacha20-poly1305 symmetric key length in bytes */
export const KEY_LENGTH = 32; // crypto_aead_xchacha20poly1305_ietf_KEYBYTES

/** xchacha20-poly1305 nonce length in bytes */
export const NONCE_LENGTH = 24; // crypto_aead_xchacha20poly1305_ietf_NPUBBYTES

/** xchacha20-poly1305 AEAD authentication tag length in bytes */
export const AEAD_TAG_LENGTH = 16; // crypto_aead_xchacha20poly1305_ietf_ABYTES

/**
 * best-effort zeroing of sensitive byte arrays.
 * call this when a session ends to clear secrets from memory.
 */
export function zeroMemory(...buffers: Uint8Array[]): void {
  for (const buf of buffers) {
    if (buf && buf.length > 0) {
      sodium.memzero(buf);
    }
  }
}

/**
 * encode bytes to base64 (for QR payload and wire format).
 */
export function toBase64(data: Uint8Array): string {
  assertReady();
  return sodium.to_base64(data, sodium.base64_variants.URLSAFE_NO_PADDING);
}

/**
 * decode base64 back to bytes.
 */
export function fromBase64(encoded: string): Uint8Array {
  assertReady();
  return sodium.from_base64(encoded, sodium.base64_variants.URLSAFE_NO_PADDING);
}

function assertReady(): void {
  if (!initialized) {
    throw new Error("crypto not initialized — call initCrypto() first");
  }
}

/** constant-time comparison to prevent timing attacks on secret data */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  // avoid early return on length mismatch — compare in constant time
  // regardless of whether lengths match to prevent timing side-channels
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length; // non-zero if lengths differ
  for (let i = 0; i < len; i++) {
    const ai = i < a.length ? a[i] : 0;
    const bi = i < b.length ? b[i] : 0;
    diff |= ai ^ bi;
  }
  return diff === 0;
}
