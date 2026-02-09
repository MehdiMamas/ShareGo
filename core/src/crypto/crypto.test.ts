import { describe, it, expect, beforeAll } from "vitest";
import {
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
  NONCE_LENGTH,
} from "./crypto.js";

beforeAll(async () => {
  await initCrypto();
});

describe("initCrypto", () => {
  it("should be idempotent", async () => {
    await initCrypto();
    await initCrypto();
  });
});

describe("generateKeyPair", () => {
  it("should produce a key pair with correct lengths", () => {
    const kp = generateKeyPair();
    expect(kp.publicKey).toBeInstanceOf(Uint8Array);
    expect(kp.secretKey).toBeInstanceOf(Uint8Array);
    expect(kp.publicKey.length).toBe(PUBLIC_KEY_LENGTH);
    expect(kp.secretKey.length).toBe(32);
  });

  it("should produce unique key pairs each time", () => {
    const a = generateKeyPair();
    const b = generateKeyPair();
    expect(toBase64(a.publicKey)).not.toBe(toBase64(b.publicKey));
    expect(toBase64(a.secretKey)).not.toBe(toBase64(b.secretKey));
  });
});

describe("deriveSharedSecret", () => {
  it("should produce matching keys for receiver and sender", () => {
    const receiver = generateKeyPair();
    const sender = generateKeyPair();

    const receiverSecret = deriveSharedSecret(receiver, sender.publicKey, true);
    const senderSecret = deriveSharedSecret(sender, receiver.publicKey, false);

    expect(toBase64(receiverSecret.encryptionKey)).toBe(toBase64(senderSecret.encryptionKey));
  });

  it("should produce 32-byte encryption keys", () => {
    const a = generateKeyPair();
    const b = generateKeyPair();
    const secret = deriveSharedSecret(a, b.publicKey, true);
    expect(secret.encryptionKey.length).toBe(32);
  });

  it("should produce different keys for different peers", () => {
    const a = generateKeyPair();
    const b = generateKeyPair();
    const c = generateKeyPair();

    const ab = deriveSharedSecret(a, b.publicKey, true);
    const ac = deriveSharedSecret(a, c.publicKey, true);

    expect(toBase64(ab.encryptionKey)).not.toBe(toBase64(ac.encryptionKey));
  });
});

describe("encrypt / decrypt", () => {
  it("should roundtrip plaintext correctly", () => {
    const kp1 = generateKeyPair();
    const kp2 = generateKeyPair();
    const secret = deriveSharedSecret(kp1, kp2.publicKey, true);

    const plaintext = new TextEncoder().encode("hunter2");
    const envelope = encrypt(plaintext, secret.encryptionKey);
    const decrypted = decrypt(envelope, secret.encryptionKey);

    expect(new TextDecoder().decode(decrypted)).toBe("hunter2");
  });

  it("should produce unique nonces per encryption", () => {
    const key = deriveSharedSecret(
      generateKeyPair(),
      generateKeyPair().publicKey,
      true,
    ).encryptionKey;

    const plaintext = new Uint8Array([1, 2, 3]);
    const a = encrypt(plaintext, key);
    const b = encrypt(plaintext, key);

    expect(a.nonce.length).toBe(NONCE_LENGTH);
    expect(toBase64(a.nonce)).not.toBe(toBase64(b.nonce));
  });

  it("should fail to decrypt with wrong key", () => {
    const key1 = deriveSharedSecret(
      generateKeyPair(),
      generateKeyPair().publicKey,
      true,
    ).encryptionKey;
    const key2 = deriveSharedSecret(
      generateKeyPair(),
      generateKeyPair().publicKey,
      true,
    ).encryptionKey;

    const plaintext = new TextEncoder().encode("secret");
    const envelope = encrypt(plaintext, key1);

    expect(() => decrypt(envelope, key2)).toThrow();
  });

  it("should fail to decrypt tampered ciphertext", () => {
    const key = deriveSharedSecret(
      generateKeyPair(),
      generateKeyPair().publicKey,
      true,
    ).encryptionKey;

    const envelope = encrypt(new Uint8Array([1, 2, 3]), key);
    // tamper with ciphertext
    envelope.ciphertext[0] ^= 0xff;

    expect(() => decrypt(envelope, key)).toThrow();
  });

  it("should handle empty plaintext", () => {
    const key = deriveSharedSecret(
      generateKeyPair(),
      generateKeyPair().publicKey,
      true,
    ).encryptionKey;

    const plaintext = new Uint8Array(0);
    const envelope = encrypt(plaintext, key);
    const decrypted = decrypt(envelope, key);
    expect(decrypted.length).toBe(0);
  });
});

describe("generateSessionId", () => {
  it("should produce a 6-character string", () => {
    const id = generateSessionId();
    expect(id.length).toBe(6);
  });

  it("should only contain valid characters (no 0/O/1/I)", () => {
    const allowed = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (let i = 0; i < 50; i++) {
      const id = generateSessionId();
      for (const char of id) {
        expect(allowed).toContain(char);
      }
    }
  });

  it("should produce unique ids", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateSessionId());
    }
    // with 32^6 possibilities, 100 ids should all be unique
    expect(ids.size).toBe(100);
  });
});

describe("generateNonce", () => {
  it("should produce 32 random bytes", () => {
    const nonce = generateNonce();
    expect(nonce).toBeInstanceOf(Uint8Array);
    expect(nonce.length).toBe(32);
  });

  it("should produce unique nonces", () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(toBase64(a)).not.toBe(toBase64(b));
  });
});

describe("zeroMemory", () => {
  it("should zero all bytes in a buffer", () => {
    const buf = new Uint8Array([1, 2, 3, 4, 5]);
    zeroMemory(buf);
    for (const byte of buf) {
      expect(byte).toBe(0);
    }
  });

  it("should handle empty buffers without throwing", () => {
    expect(() => zeroMemory(new Uint8Array(0))).not.toThrow();
  });

  it("should handle multiple buffers", () => {
    const a = new Uint8Array([10, 20]);
    const b = new Uint8Array([30, 40]);
    zeroMemory(a, b);
    expect(a[0]).toBe(0);
    expect(b[0]).toBe(0);
  });
});

describe("toBase64 / fromBase64", () => {
  it("should roundtrip bytes correctly", () => {
    const original = new Uint8Array([0, 1, 127, 128, 255]);
    const encoded = toBase64(original);
    const decoded = fromBase64(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(original));
  });

  it("should produce url-safe base64 without padding", () => {
    const data = new Uint8Array([0, 1, 2, 3]);
    const encoded = toBase64(data);
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("=");
  });

  it("should handle empty data", () => {
    const encoded = toBase64(new Uint8Array(0));
    const decoded = fromBase64(encoded);
    expect(decoded.length).toBe(0);
  });
});

describe("constants", () => {
  it("PUBLIC_KEY_LENGTH should be 32", () => {
    expect(PUBLIC_KEY_LENGTH).toBe(32);
  });

  it("NONCE_LENGTH should be 24", () => {
    expect(NONCE_LENGTH).toBe(24);
  });
});

/**
 * cross-platform test vectors generated from libsodium-wrappers-sumo (WASM).
 * these verify that mobile's compat shim (JSI + tweetnacl) produces
 * identical results. regenerate with: node scripts/generate-crypto-vectors.mjs
 */
describe("cross-platform crypto vectors", () => {
  const EXPECTED = {
    clientPublicKey: "RwHQhIhFH1RaQJ-1iuPlhYHKQKw_fxFGmM1x3qxzygE",
    clientSecretKey: "PZTupJxYCu-BaTV2K-BJVZ1tFEDe3hLmoSXxhB__jm8",
    serverPublicKey: "PecMsrm7C9o4c9E-inz06ocNq-spbKod_OCl9BHI0jQ",
    serverSecretKey: "xZwc1yCXdgEBriGaZKcc19evUUbkTkJ8ZpIkV4Pl8no",
    serverRx: "7bTLfMcn_AW5T9uZFb_U8Ca0hWS0KBHry7OGZl_y7ZI",
    serverTx: "RlFfiBokRwuqFzD-aeR88pJ-rF4uX78MsXJfwWHawZc",
    clientRx: "RlFfiBokRwuqFzD-aeR88pJ-rF4uX78MsXJfwWHawZc",
    clientTx: "7bTLfMcn_AW5T9uZFb_U8Ca0hWS0KBHry7OGZl_y7ZI",
    fixedNonce: "QEFCQ0RFRkdISUpLTE1OT1BRUlNUVVZX",
    ciphertext: "6j_YoyDCQsRijyyCYeIg1T7rc2Bu4waAzo3e1hTzV_EHeks",
  };

  // need sodium primitives directly for seeded keypair generation
  let sodium: typeof import("libsodium-wrappers-sumo");

  // deterministic seeds: client = 0x00..0x1f, server = 0x80..0x9f
  let clientSeed: Uint8Array;
  let serverSeed: Uint8Array;

  beforeAll(async () => {
    const mod = await import("libsodium-wrappers-sumo");
    sodium = mod.default ?? mod;
    await sodium.ready;
    clientSeed = fromBase64("AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8");
    serverSeed = fromBase64("gIGCg4SFhoeIiYqLjI2Oj5CRkpOUlZaXmJmam5ydnp8");
  });

  it("should produce expected keypairs from deterministic seeds", () => {
    const clientKp = sodium.crypto_box_seed_keypair(clientSeed);
    const serverKp = sodium.crypto_box_seed_keypair(serverSeed);

    expect(toBase64(clientKp.publicKey)).toBe(EXPECTED.clientPublicKey);
    expect(toBase64(clientKp.privateKey)).toBe(EXPECTED.clientSecretKey);
    expect(toBase64(serverKp.publicKey)).toBe(EXPECTED.serverPublicKey);
    expect(toBase64(serverKp.privateKey)).toBe(EXPECTED.serverSecretKey);
  });

  it("should derive expected session keys (server side)", () => {
    const clientKp = sodium.crypto_box_seed_keypair(clientSeed);
    const serverKp = sodium.crypto_box_seed_keypair(serverSeed);

    const serverKeys = sodium.crypto_kx_server_session_keys(
      serverKp.publicKey,
      serverKp.privateKey,
      clientKp.publicKey,
    );

    expect(toBase64(serverKeys.sharedRx)).toBe(EXPECTED.serverRx);
    expect(toBase64(serverKeys.sharedTx)).toBe(EXPECTED.serverTx);
  });

  it("should derive expected session keys (client side)", () => {
    const clientKp = sodium.crypto_box_seed_keypair(clientSeed);
    const serverKp = sodium.crypto_box_seed_keypair(serverSeed);

    const clientKeys = sodium.crypto_kx_client_session_keys(
      clientKp.publicKey,
      clientKp.privateKey,
      serverKp.publicKey,
    );

    expect(toBase64(clientKeys.sharedRx)).toBe(EXPECTED.clientRx);
    expect(toBase64(clientKeys.sharedTx)).toBe(EXPECTED.clientTx);
  });

  it("server rx should equal client tx and vice versa", () => {
    expect(EXPECTED.serverRx).toBe(EXPECTED.clientTx);
    expect(EXPECTED.serverTx).toBe(EXPECTED.clientRx);
  });

  it("should produce expected AEAD ciphertext with null additional_data", () => {
    const encryptionKey = fromBase64(EXPECTED.serverRx);
    const nonce = fromBase64(EXPECTED.fixedNonce);
    const plaintext = new TextEncoder().encode("ShareGo test vector");

    const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      plaintext,
      null,
      null,
      nonce,
      encryptionKey,
    );

    expect(toBase64(ciphertext)).toBe(EXPECTED.ciphertext);
  });

  it("should decrypt expected AEAD ciphertext correctly", () => {
    const encryptionKey = fromBase64(EXPECTED.serverRx);
    const nonce = fromBase64(EXPECTED.fixedNonce);
    const ciphertext = fromBase64(EXPECTED.ciphertext);

    const decrypted = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      ciphertext,
      null,
      nonce,
      encryptionKey,
    );

    expect(new TextDecoder().decode(decrypted)).toBe("ShareGo test vector");
  });
});
