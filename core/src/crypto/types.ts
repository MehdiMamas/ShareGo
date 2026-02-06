/** ephemeral X25519 key pair — generated fresh per session */
export interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

/** result of a key exchange — shared secret for AEAD */
export interface SharedSecret {
  /** derived encryption key (32 bytes) */
  encryptionKey: Uint8Array;
}

/** encrypted envelope returned by encrypt() */
export interface EncryptedEnvelope {
  /** ciphertext including AEAD tag */
  ciphertext: Uint8Array;
  /** nonce used for this message (24 bytes for XChaCha20) */
  nonce: Uint8Array;
}
