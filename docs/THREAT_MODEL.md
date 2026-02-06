# ShareGo — Threat Model

## Scope

ShareGo transfers sensitive data (passwords, OTPs, short text) between two devices on the same local network. This document covers what threats we accept, what we mitigate, and what crypto primitives we use.

## Platforms covered

Windows, macOS, Linux, Android, iOS — all using the same shared crypto and protocol core.

## Crypto primitives

| Primitive         | Algorithm                              | Library                     |
|-------------------|----------------------------------------|-----------------------------|
| Key exchange      | X25519 (ephemeral, per-session)        | libsodium `crypto_kx`      |
| Encryption        | XChaCha20-Poly1305 (AEAD)             | libsodium `crypto_aead`    |
| Key derivation    | BLAKE2b (via libsodium key exchange)   | libsodium `crypto_kx`      |
| Nonce generation  | Random (24 bytes per message)          | libsodium `randombytes_buf` |
| Session ID        | Random (6-char alphanumeric)           | libsodium `randombytes_buf` |
| Memory zeroing    | Best-effort via `sodium.memzero()`     | libsodium `memzero`        |

All crypto is performed by libsodium (`libsodium-wrappers-sumo`), a well-audited, portable crypto library. No platform-specific crypto APIs are used.

## Threats we accept (out of scope)

These threats are outside the control of the application. If an attacker has achieved any of these, no application-level security can help.

### Compromised device OS

If the operating system is compromised (rootkit, malware with root/admin access), the attacker can read process memory, intercept system calls, and access any data the app handles. ShareGo cannot protect against this.

### Physical attacker with unlocked device

If an attacker has physical access to an unlocked device, they can read the screen, copy clipboard contents, and interact with the app directly. ShareGo cannot prevent this.

### Malicious OS-level keylogger

If a keylogger is installed at the OS level, it can capture any text the user types or copies. This is outside the app's control.

### Compromised libsodium

If the libsodium library itself has a vulnerability, all crypto is affected. We mitigate this by using the latest audited release and monitoring for advisories.

## Threats we mitigate

### Wi-Fi sniffing

**Threat:** An attacker on the same Wi-Fi network captures packets and reads the data being transferred.

**Mitigation:** All data is encrypted end-to-end with XChaCha20-Poly1305. The shared key is derived via X25519 key exchange with ephemeral keys. Even if packets are captured, the data is indecipherable without the ephemeral secret keys, which exist only in memory and are zeroed after the session ends.

### QR code / pairing code leakage

**Threat:** An attacker photographs the QR code or observes the manual pairing code.

**Mitigation:**
- QR codes and manual codes expire after 90 seconds (configurable)
- Codes are one-use: after the first sender connects, the code is invalidated
- The QR contains only the public key and address, not any sensitive data
- The receiver must explicitly approve the pairing — a stolen code alone is not enough

### Replay attacks

**Threat:** An attacker captures encrypted messages and replays them later.

**Mitigation:**
- Each session uses fresh ephemeral keys — replayed messages from a previous session will fail decryption
- Each message has a monotonically increasing sequence number — duplicate or out-of-order messages are rejected
- Each DATA message uses a fresh random nonce — identical plaintext produces different ciphertext

### Unauthorized session joins

**Threat:** An attacker on the same network attempts to join a session they were not invited to.

**Mitigation:**
- Sessions are limited to exactly 2 participants
- The receiver must explicitly approve every pairing request
- After the first sender is accepted, no additional connections are allowed
- The session ID is 6 characters from a 30-character alphabet (30^6 = 729 million combinations) — brute-forcing within the 90-second window is impractical
- The handshake requires a challenge-response proof of key possession

### Accidental data re-send

**Threat:** A user accidentally sends the same sensitive data multiple times or to the wrong session.

**Mitigation:**
- Sessions are short-lived (default 5-minute TTL)
- Each session requires explicit creation and pairing
- The UI should confirm before sending (app-level, not protocol-level)

### Clipboard persistence

**Threat:** After receiving a password or OTP, it remains in the device clipboard indefinitely.

**Mitigation:**
- The app provides an auto-clear option: clipboard is cleared after a configurable timeout (e.g. 30 seconds)
- The UI warns the user that data has been copied to clipboard
- On Android 13+: clipboard auto-clear is handled by the OS for sensitive content

### Session hijacking

**Threat:** An attacker takes over an existing session by impersonating one of the participants.

**Mitigation:**
- Ephemeral X25519 keys are generated per session and never reused
- The shared key is derived from both participants' ephemeral keys — an attacker cannot derive the same shared key without the secret key
- The challenge-response handshake verifies that both sides possess the correct keys before any data flows
- AEAD encryption with the shared key means any tampered message is rejected (authentication tag check fails)

### Man-in-the-middle (on LAN)

**Threat:** An attacker on the same LAN intercepts the WebSocket connection and performs a MITM attack.

**Mitigation for QR mode:** The receiver's public key is embedded in the QR code, which is transmitted out-of-band (displayed on screen, scanned by camera). An attacker would need to both intercept the QR scan AND the network connection simultaneously.

**Mitigation for manual pairing mode:** The receiver's public key is exchanged in the CHALLENGE message over the WebSocket. In this mode, a MITM is theoretically possible if the attacker intercepts before the CHALLENGE. However:
- The receiver must approve the pairing (and sees the device name)
- Future enhancement: display a verification code derived from both public keys for visual confirmation (like Signal's safety numbers)

## Security decisions

### Why ephemeral keys only

Keys are generated fresh for every session and never persisted. This provides forward secrecy: even if an attacker later compromises a device, they cannot decrypt past sessions because the keys no longer exist.

### Why XChaCha20-Poly1305

- 24-byte nonce eliminates nonce collision risk with random nonces
- AEAD provides both confidentiality and integrity
- Well-studied, no known practical attacks
- Efficient in software (no AES hardware needed)
- Available on all platforms via libsodium

### Why libsodium (not platform crypto APIs)

- One implementation across all 5 platforms — no behavioral differences
- Audited, well-documented, misuse-resistant API
- No dependency on platform-specific key stores or secure enclaves (which would complicate the ephemeral model)

### Why one sender max

Limiting sessions to exactly 2 participants eliminates an entire class of group-session attacks (key distribution, participant ordering, member removal). It also simplifies the protocol and UI significantly.

### Why receiver approval is mandatory

Auto-accept would allow anyone on the same network who obtains the session ID to join. Requiring explicit approval puts the receiver in control and makes social engineering attacks visible.

### Why best-effort memory zeroing

JavaScript/TypeScript does not guarantee memory zeroing — the garbage collector may copy buffers, and we cannot control the JIT compiler's behavior. We use `sodium.memzero()` as the best available option, knowing it is not a cryptographic guarantee. For truly sensitive deployments, the core could be reimplemented in Rust (via Tauri's backend) with guaranteed memory zeroing.
