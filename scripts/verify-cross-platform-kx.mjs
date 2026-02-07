/**
 * verifies that the compat shim's crypto_kx implementation (tweetnacl + BLAKE2b)
 * produces identical results to libsodium-wrappers-sumo's native crypto_kx.
 *
 * this simulates the exact cross-platform scenario:
 *   - "mobile" side: crypto_box_keypair + tweetnacl.scalarMult + generichash
 *   - "desktop" side: crypto_kx_keypair + crypto_kx_server/client_session_keys
 */
import _sodium from "../node_modules/libsodium-wrappers-sumo/dist/modules-sumo/libsodium-wrappers.js";
import _nacl from "../node_modules/tweetnacl/nacl-fast.js";

const nacl = _nacl.default ?? _nacl;
await _sodium.ready;
const sodium = _sodium;

const b64 = (buf) => sodium.to_base64(buf, sodium.base64_variants.URLSAFE_NO_PADDING);

// --- simulate mobile side (compat shim) ---
function mobileKeyPair(seed) {
  const kp = sodium.crypto_box_seed_keypair(seed);
  return { publicKey: new Uint8Array(kp.publicKey), secretKey: new Uint8Array(kp.privateKey) };
}

function mobileClientSessionKeys(client_pk, client_sk, server_pk) {
  const q = nacl.scalarMult(new Uint8Array(client_sk), new Uint8Array(server_pk));
  const input = new Uint8Array(96);
  input.set(q, 0);
  input.set(new Uint8Array(client_pk), 32);
  input.set(new Uint8Array(server_pk), 64);
  const keys = sodium.crypto_generichash(64, input);
  // client: rx = first 32, tx = last 32 (no swap, matches libsodium)
  return {
    sharedRx: new Uint8Array(keys.slice(0, 32)),
    sharedTx: new Uint8Array(keys.slice(32, 64)),
  };
}

function mobileServerSessionKeys(server_pk, server_sk, client_pk) {
  const q = nacl.scalarMult(new Uint8Array(server_sk), new Uint8Array(client_pk));
  const input = new Uint8Array(96);
  input.set(q, 0);
  input.set(new Uint8Array(client_pk), 32);
  input.set(new Uint8Array(server_pk), 64);
  const keys = sodium.crypto_generichash(64, input);
  // server: rx = last 32, tx = first 32 (SWAPPED, matches libsodium)
  return {
    sharedRx: new Uint8Array(keys.slice(32, 64)),
    sharedTx: new Uint8Array(keys.slice(0, 32)),
  };
}

// --- simulate desktop side (native libsodium) ---
function desktopKeyPair(seed) {
  // crypto_kx_keypair uses same keys as crypto_box_keypair
  const kp = sodium.crypto_box_seed_keypair(seed);
  return { publicKey: kp.publicKey, secretKey: kp.privateKey };
}

// --- test 1: deterministic seeds ---
console.log("=== Test 1: deterministic seeds ===");
const clientSeed = new Uint8Array(32);
const serverSeed = new Uint8Array(32);
for (let i = 0; i < 32; i++) { clientSeed[i] = i; serverSeed[i] = i + 0x80; }

const mobileClient = mobileKeyPair(clientSeed);
const desktopServer = desktopKeyPair(serverSeed);

console.log("mobile client PK:", b64(mobileClient.publicKey));
console.log("desktop server PK:", b64(desktopServer.publicKey));

// mobile is sender (client), desktop is receiver (server)
const mobileKeys = mobileClientSessionKeys(
  mobileClient.publicKey, mobileClient.secretKey, desktopServer.publicKey
);
const desktopKeys = sodium.crypto_kx_server_session_keys(
  desktopServer.publicKey, desktopServer.secretKey, mobileClient.publicKey
);

console.log("\nmobile clientTx:", b64(mobileKeys.sharedTx));
console.log("desktop serverRx:", b64(desktopKeys.sharedRx));
console.log("MATCH:", b64(mobileKeys.sharedTx) === b64(desktopKeys.sharedRx));

console.log("\nmobile clientRx:", b64(mobileKeys.sharedRx));
console.log("desktop serverTx:", b64(desktopKeys.sharedTx));
console.log("MATCH:", b64(mobileKeys.sharedRx) === b64(desktopKeys.sharedTx));

// --- test 2: verify DH step independently ---
console.log("\n=== Test 2: DH step comparison ===");
const q_mobile = nacl.scalarMult(
  new Uint8Array(mobileClient.secretKey),
  new Uint8Array(desktopServer.publicKey)
);
const q_desktop = sodium.crypto_scalarmult(
  desktopServer.secretKey,
  mobileClient.publicKey
);
console.log("q (mobile/tweetnacl):", b64(q_mobile));
console.log("q (desktop/libsodium):", b64(q_desktop));
console.log("DH MATCH:", b64(q_mobile) === b64(q_desktop));

// Note: DH is commutative, so client_sk * server_pk = server_sk * client_pk
const q_desktop_reverse = sodium.crypto_scalarmult(
  mobileClient.secretKey,
  desktopServer.publicKey
);
console.log("q (desktop/reverse):", b64(q_desktop_reverse));
console.log("DH reverse MATCH:", b64(q_mobile) === b64(q_desktop_reverse));

// --- test 3: AEAD with derived key ---
console.log("\n=== Test 3: AEAD cross-platform ===");
const encKey = mobileKeys.sharedTx;  // sender uses clientTx
const nonce = sodium.randombytes_buf(24);
const plaintext = new TextEncoder().encode("hello from mobile");

// encrypt on "mobile" side
const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
  plaintext, null, null, nonce, encKey
);

// decrypt on "desktop" side using serverRx
try {
  const decrypted = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null, ciphertext, null, nonce, desktopKeys.sharedRx
  );
  console.log("AEAD roundtrip:", new TextDecoder().decode(decrypted));
  console.log("AEAD PASS");
} catch (e) {
  console.log("AEAD FAIL:", e.message);
}

// --- test 4: random keys (more realistic) ---
console.log("\n=== Test 4: random keys ===");
for (let trial = 0; trial < 5; trial++) {
  const mKP = { ...sodium.crypto_box_keypair() };
  mKP.secretKey = mKP.privateKey;
  const dKP = { ...sodium.crypto_kx_keypair() };
  dKP.secretKey = dKP.privateKey;
  
  const mKeys = mobileClientSessionKeys(mKP.publicKey, mKP.secretKey, dKP.publicKey);
  const dKeys = sodium.crypto_kx_server_session_keys(dKP.publicKey, dKP.secretKey, mKP.publicKey);
  
  const match = b64(mKeys.sharedTx) === b64(dKeys.sharedRx);
  console.log(`Trial ${trial + 1}: ${match ? "PASS" : "FAIL"}`);
  if (!match) {
    console.log("  mobile clientTx:", b64(mKeys.sharedTx));
    console.log("  desktop serverRx:", b64(dKeys.sharedRx));
  }
}

console.log("\n=== Test 5: encrypt on mobile shim, decrypt on desktop ===");
// simulate encrypt with "" additional_data (mobile compat shim path)
const testKey = mobileKeys.sharedTx;
const testNonce = sodium.randombytes_buf(24);
const testPlain = new TextEncoder().encode("proof challenge");

// mobile encrypt (ad = "" instead of null)
const testCipher = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
  testPlain, "", null, testNonce, testKey
);

// desktop decrypt (ad = null)
try {
  const dec = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null, testCipher, null, testNonce, desktopKeys.sharedRx
  );
  console.log('Encrypt(ad="") -> Decrypt(ad=null):', new TextDecoder().decode(dec));
  console.log("PASS");
} catch (e) {
  console.log('FAIL: Encrypt(ad="") incompatible with Decrypt(ad=null):', e.message);
}

// also test: encrypt with ad=null, decrypt with ad=""
const testCipher2 = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
  testPlain, null, null, testNonce, testKey
);

try {
  const dec2 = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null, testCipher2, "", testNonce, desktopKeys.sharedRx
  );
  console.log('Encrypt(ad=null) -> Decrypt(ad=""):', new TextDecoder().decode(dec2));
  console.log("PASS");
} catch (e) {
  console.log('FAIL: Encrypt(ad=null) incompatible with Decrypt(ad=""):', e.message);
}
