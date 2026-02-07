/**
 * compatibility shim for libsodium-wrappers-sumo in react native.
 *
 * uses react-native-libsodium (native JSI) for the functions it supports,
 * and fills in missing pieces:
 *   - crypto_kx_* via tweetnacl (pure JS X25519 DH) + JSI crypto_generichash
 *   - crypto_aead_* wrappers to coerce null additional_data to "" (JSI only accepts string)
 *   - memzero (best-effort)
 *
 * the native JSI doesn't implement crypto_kx because it wasn't added to the
 * C++ bindings, but we can reimplement it exactly using:
 *   - tweetnacl.scalarMult (X25519 DH)
 *   - crypto_generichash (BLAKE2b, from JSI)
 *   - crypto_box_keypair (same as crypto_kx_keypair, from JSI)
 *
 * security note: this file is a custom crypto surface. any changes must be
 * reviewed against libsodium's reference implementation and tested with
 * cross-platform test vectors (desktop WASM <-> mobile JSI).
 */
import * as sodium from "react-native-libsodium";
import nacl from "tweetnacl";

const CRYPTO_KX_PUBLICKEYBYTES = 32;
const CRYPTO_KX_SECRETKEYBYTES = 32;

// crypto_kx_keypair is identical to crypto_box_keypair (both X25519)
function crypto_kx_keypair() {
  const kp = sodium.crypto_box_keypair();
  return {
    publicKey: new Uint8Array(kp.publicKey),
    privateKey: new Uint8Array(kp.privateKey),
    keyType: "x25519",
  };
}

/**
 * derive server session keys using X25519 DH + BLAKE2b.
 * reimplements libsodium's crypto_kx_server_session_keys exactly:
 *   keys = BLAKE2b-512(q || client_pk || server_pk)
 *   server_rx = keys[0:32], server_tx = keys[32:64]
 */
function crypto_kx_server_session_keys(server_pk, server_sk, client_pk) {
  const spk = new Uint8Array(server_pk);
  const ssk = new Uint8Array(server_sk);
  const cpk = new Uint8Array(client_pk);

  if (spk.length !== CRYPTO_KX_PUBLICKEYBYTES) {
    throw new Error("crypto_kx_server_session_keys: invalid server_pk length");
  }
  if (ssk.length !== CRYPTO_KX_SECRETKEYBYTES) {
    throw new Error("crypto_kx_server_session_keys: invalid server_sk length");
  }
  if (cpk.length !== CRYPTO_KX_PUBLICKEYBYTES) {
    throw new Error("crypto_kx_server_session_keys: invalid client_pk length");
  }

  // step 1: X25519 DH exchange
  const q = nacl.scalarMult(ssk, cpk);

  // step 2: concatenate q || client_pk || server_pk (96 bytes)
  const input = new Uint8Array(96);
  input.set(q, 0);
  input.set(cpk, 32);
  input.set(spk, 64);

  // step 3: BLAKE2b-512 hash
  const keys = sodium.crypto_generichash(64, input);

  // server: rx = LAST 32 bytes, tx = FIRST 32 bytes (swapped from client)
  // this matches libsodium's crypto_kx_server_session_keys exactly:
  // server swaps so that server.rx == client.tx and server.tx == client.rx
  const result = {
    sharedRx: new Uint8Array(keys.slice(32, 64)),
    sharedTx: new Uint8Array(keys.slice(0, 32)),
  };

  // best-effort zeroing of intermediate secrets
  memzero(q);
  memzero(input);

  return result;
}

/**
 * derive client session keys using X25519 DH + BLAKE2b.
 * same hash as server but rx/tx are swapped so they can communicate.
 */
function crypto_kx_client_session_keys(client_pk, client_sk, server_pk) {
  const cpk = new Uint8Array(client_pk);
  const csk = new Uint8Array(client_sk);
  const spk = new Uint8Array(server_pk);

  if (cpk.length !== CRYPTO_KX_PUBLICKEYBYTES) {
    throw new Error("crypto_kx_client_session_keys: invalid client_pk length");
  }
  if (csk.length !== CRYPTO_KX_SECRETKEYBYTES) {
    throw new Error("crypto_kx_client_session_keys: invalid client_sk length");
  }
  if (spk.length !== CRYPTO_KX_PUBLICKEYBYTES) {
    throw new Error("crypto_kx_client_session_keys: invalid server_pk length");
  }

  // step 1: X25519 DH exchange
  const q = nacl.scalarMult(csk, spk);

  // step 2: concatenate q || client_pk || server_pk (96 bytes)
  const input = new Uint8Array(96);
  input.set(q, 0);
  input.set(cpk, 32);
  input.set(spk, 64);

  // step 3: BLAKE2b-512 hash
  const keys = sodium.crypto_generichash(64, input);

  // client: rx = FIRST 32 bytes, tx = LAST 32 bytes (no swap)
  // this matches libsodium's crypto_kx_client_session_keys exactly
  const result = {
    sharedRx: new Uint8Array(keys.slice(0, 32)),
    sharedTx: new Uint8Array(keys.slice(32, 64)),
  };

  // best-effort zeroing of intermediate secrets
  memzero(q);
  memzero(input);

  return result;
}

/**
 * wrapper around JSI crypto_aead_xchacha20poly1305_ietf_encrypt.
 * the JSI binding requires additional_data to be a string — it throws
 * "input type not yet implemented" when null/Uint8Array is passed.
 * libsodium's C API treats (NULL, 0) the same as ("", 0) for ad,
 * so coercing null to "" is safe and cryptographically equivalent.
 */
function crypto_aead_xchacha20poly1305_ietf_encrypt(
  message,
  additional_data,
  secret_nonce,
  public_nonce,
  key,
  outputFormat,
) {
  const ad = additional_data == null ? "" : String(additional_data);
  return sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    message,
    ad,
    secret_nonce,
    public_nonce,
    key,
    outputFormat,
  );
}

/**
 * wrapper around JSI crypto_aead_xchacha20poly1305_ietf_decrypt.
 * same null -> "" coercion for additional_data as encrypt.
 */
function crypto_aead_xchacha20poly1305_ietf_decrypt(
  secret_nonce,
  ciphertext,
  additional_data,
  public_nonce,
  key,
  outputFormat,
) {
  const ad = additional_data == null ? "" : String(additional_data);
  return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
    secret_nonce,
    ciphertext,
    ad,
    public_nonce,
    key,
    outputFormat,
  );
}

// best-effort memory zeroing (can't guarantee constant-time in JS)
function memzero(buf) {
  if (buf && buf.length > 0) {
    for (let i = 0; i < buf.length; i++) {
      buf[i] = 0;
    }
  }
}

// re-export everything from react-native-libsodium with our additions/overrides
const compat = {
  ...sodium,
  // override ready to be immediately resolved (JSI is sync)
  ready: Promise.resolve(),
  // add missing functions
  crypto_kx_keypair,
  crypto_kx_server_session_keys,
  crypto_kx_client_session_keys,
  memzero,
  // override AEAD to fix null additional_data handling
  crypto_aead_xchacha20poly1305_ietf_encrypt,
  crypto_aead_xchacha20poly1305_ietf_decrypt,
};

export default compat;
export {
  crypto_kx_keypair,
  crypto_kx_server_session_keys,
  crypto_kx_client_session_keys,
  memzero,
  crypto_aead_xchacha20poly1305_ietf_encrypt,
  crypto_aead_xchacha20poly1305_ietf_decrypt,
};
