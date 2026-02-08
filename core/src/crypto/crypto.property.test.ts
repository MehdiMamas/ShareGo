import { describe, it, expect, beforeAll } from "vitest";
import fc from "fast-check";
import {
  initCrypto,
  generateKeyPair,
  deriveSharedSecret,
  encrypt,
  decrypt,
  toBase64,
  fromBase64,
  zeroMemory,
  NONCE_LENGTH,
  AEAD_TAG_LENGTH,
} from "./crypto.js";

beforeAll(async () => {
  await initCrypto();
});

describe("property: encrypt/decrypt roundtrip", () => {
  it("should roundtrip arbitrary byte arrays", () => {
    const receiver = generateKeyPair();
    const sender = generateKeyPair();
    const receiverSecret = deriveSharedSecret(receiver, sender.publicKey, true);
    const senderSecret = deriveSharedSecret(sender, receiver.publicKey, false);

    fc.assert(
      fc.property(fc.uint8Array({ minLength: 0, maxLength: 4096 }), (plaintext) => {
        const envelope = encrypt(plaintext, senderSecret.encryptionKey);
        const decrypted = decrypt(envelope, receiverSecret.encryptionKey);

        expect(decrypted.length).toBe(plaintext.length);
        for (let i = 0; i < plaintext.length; i++) {
          expect(decrypted[i]).toBe(plaintext[i]);
        }
      }),
      { numRuns: 50 },
    );
  });

  it("should produce ciphertext longer than plaintext by exactly AEAD_TAG_LENGTH", () => {
    const kp1 = generateKeyPair();
    const kp2 = generateKeyPair();
    const secret = deriveSharedSecret(kp1, kp2.publicKey, true);

    fc.assert(
      fc.property(fc.uint8Array({ minLength: 0, maxLength: 1024 }), (plaintext) => {
        const envelope = encrypt(plaintext, secret.encryptionKey);
        expect(envelope.ciphertext.length).toBe(plaintext.length + AEAD_TAG_LENGTH);
      }),
      { numRuns: 50 },
    );
  });

  it("should always produce 24-byte nonces", () => {
    const kp1 = generateKeyPair();
    const kp2 = generateKeyPair();
    const secret = deriveSharedSecret(kp1, kp2.publicKey, true);

    fc.assert(
      fc.property(fc.uint8Array({ minLength: 1, maxLength: 256 }), (plaintext) => {
        const envelope = encrypt(plaintext, secret.encryptionKey);
        expect(envelope.nonce.length).toBe(NONCE_LENGTH);
      }),
      { numRuns: 50 },
    );
  });
});

describe("property: nonce uniqueness", () => {
  it("should never produce duplicate nonces across many encryptions", () => {
    const kp1 = generateKeyPair();
    const kp2 = generateKeyPair();
    const secret = deriveSharedSecret(kp1, kp2.publicKey, true);
    const plaintext = new Uint8Array([42]);

    const nonces = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const envelope = encrypt(plaintext, secret.encryptionKey);
      nonces.add(toBase64(envelope.nonce));
    }
    expect(nonces.size).toBe(200);
  });
});

describe("property: key pair uniqueness", () => {
  it("should produce unique key pairs", () => {
    const publicKeys = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const kp = generateKeyPair();
      publicKeys.add(toBase64(kp.publicKey));
    }
    expect(publicKeys.size).toBe(100);
  });
});

describe("property: base64 roundtrip", () => {
  it("should roundtrip arbitrary byte arrays through base64", () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 0, maxLength: 4096 }), (data) => {
        const encoded = toBase64(data);
        const decoded = fromBase64(encoded);
        expect(decoded.length).toBe(data.length);
        for (let i = 0; i < data.length; i++) {
          expect(decoded[i]).toBe(data[i]);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("should produce url-safe base64 without padding", () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 1, maxLength: 256 }), (data) => {
        const encoded = toBase64(data);
        expect(encoded).not.toContain("+");
        expect(encoded).not.toContain("/");
        expect(encoded).not.toContain("=");
      }),
      { numRuns: 100 },
    );
  });
});

describe("property: ciphertext tamper detection", () => {
  it("should reject any single-bit flip in ciphertext", () => {
    const kp1 = generateKeyPair();
    const kp2 = generateKeyPair();
    const secret = deriveSharedSecret(kp1, kp2.publicKey, true);

    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 1, maxLength: 256 }),
        fc.nat(),
        (plaintext, byteIndex) => {
          const envelope = encrypt(plaintext, secret.encryptionKey);
          const idx = byteIndex % envelope.ciphertext.length;
          envelope.ciphertext[idx] ^= 0x01;
          expect(() => decrypt(envelope, secret.encryptionKey)).toThrow();
        },
      ),
      { numRuns: 30 },
    );
  });

  it("should reject decryption with wrong key", () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 1, maxLength: 256 }), (plaintext) => {
        const kp1 = generateKeyPair();
        const kp2 = generateKeyPair();
        const kp3 = generateKeyPair();
        const correctKey = deriveSharedSecret(kp1, kp2.publicKey, true);
        const wrongKey = deriveSharedSecret(kp1, kp3.publicKey, true);

        const envelope = encrypt(plaintext, correctKey.encryptionKey);
        expect(() => decrypt(envelope, wrongKey.encryptionKey)).toThrow();
      }),
      { numRuns: 20 },
    );
  });
});

describe("property: zeroMemory", () => {
  it("should zero all bytes for arbitrary buffer sizes", () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 0, maxLength: 1024 }), (data) => {
        // copy to avoid modifying original
        const buf = new Uint8Array(data);
        zeroMemory(buf);
        for (const byte of buf) {
          expect(byte).toBe(0);
        }
      }),
      { numRuns: 50 },
    );
  });
});
