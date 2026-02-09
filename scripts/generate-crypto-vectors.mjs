/**
 * generates deterministic crypto test vectors using libsodium-wrappers-sumo (WASM).
 * these vectors are used to verify cross-platform compatibility between
 * desktop (WASM) and mobile (JSI + tweetnacl compat shim).
 *
 * run: node scripts/generate-crypto-vectors.mjs
 */
import _sodium from "../node_modules/libsodium-wrappers-sumo/dist/modules-sumo/libsodium-wrappers.js";

await _sodium.ready;
const sodium = _sodium;

// deterministic seeds (32 bytes each) — fixed values for reproducibility
const clientSeed = new Uint8Array(32);
const serverSeed = new Uint8Array(32);
for (let i = 0; i < 32; i++) {
  clientSeed[i] = i; // 0x00..0x1f
  serverSeed[i] = i + 0x80; // 0x80..0x9f
}

// generate deterministic keypairs from seeds (crypto_box_seed_keypair = X25519)
const clientKp = sodium.crypto_box_seed_keypair(clientSeed);
const serverKp = sodium.crypto_box_seed_keypair(serverSeed);

// derive session keys
const serverKeys = sodium.crypto_kx_server_session_keys(
  serverKp.publicKey,
  serverKp.privateKey,
  clientKp.publicKey,
);

const clientKeys = sodium.crypto_kx_client_session_keys(
  clientKp.publicKey,
  clientKp.privateKey,
  serverKp.publicKey,
);

// encrypt/decrypt roundtrip with a fixed nonce
const encryptionKey = serverKeys.sharedRx; // server rx = client tx
const fixedNonce = new Uint8Array(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
for (let i = 0; i < fixedNonce.length; i++) fixedNonce[i] = i + 0x40;

const plaintext = new TextEncoder().encode("ShareGo test vector");
const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
  plaintext,
  null, // no additional data
  null, // no secret nonce
  fixedNonce,
  encryptionKey,
);

const b64 = (buf) => sodium.to_base64(buf, sodium.base64_variants.URLSAFE_NO_PADDING);

const vectors = {
  clientSeed: b64(clientSeed),
  serverSeed: b64(serverSeed),
  clientPublicKey: b64(clientKp.publicKey),
  clientSecretKey: b64(clientKp.privateKey),
  serverPublicKey: b64(serverKp.publicKey),
  serverSecretKey: b64(serverKp.privateKey),
  serverRx: b64(serverKeys.sharedRx),
  serverTx: b64(serverKeys.sharedTx),
  clientRx: b64(clientKeys.sharedRx),
  clientTx: b64(clientKeys.sharedTx),
  // verify cross-key agreement
  serverRxEqualsClientTx: b64(serverKeys.sharedRx) === b64(clientKeys.sharedTx),
  serverTxEqualsClientRx: b64(serverKeys.sharedTx) === b64(clientKeys.sharedRx),
  // AEAD test
  fixedNonce: b64(fixedNonce),
  plaintext: "ShareGo test vector",
  ciphertext: b64(ciphertext),
};

console.log(JSON.stringify(vectors, null, 2));
