# Threat model

ShareGo protects a short secret while it moves between two devices on a local network that you do not fully trust. It does not protect against someone who already controls one of the two devices.

## What it defends against

- A device on the LAN that reads packets. Payloads after the handshake are XChaCha20-Poly1305. The handshake itself only carries public keys, the session code, and a device name.
- A device that replays or reorders an encrypted frame. Each direction has its own sequence counter, and the counter is bound into the AEAD associated data.
- A device that tampers with a frame. A bad mac closes the session.
- A device that connects with a stale code. The code and the X25519 key pair change every 30 seconds, and a wrong code is denied.
- A third device joining. The listener closes after one valid HELLO.
- A substituted public key when the sender scanned the QR code. The sender compares the WELCOME key with the key on the screen.
- A substituted public key when the code was typed. Both screens show a 6-digit number from the handshake transcript. The receiver approves only if the numbers match. mDNS is not a trusted source of keys.

## What it does not defend against

- Someone who can see both screens, or who talks the receiver into approving a number that does not match.
- Malware on either device. It can read the secret before encryption or after decryption.
- A denial of service on the LAN. The design assumes the two devices can reach each other.
- Traffic analysis. An observer can see that two devices talked, and roughly how much.
- A stolen phone after the session. Messages are not written to disk, but they are on screen until the session ends.

## Primitives

| Step | Primitive |
| --- | --- |
| Key agreement | X25519, a new key pair every code |
| Key derivation | HKDF-SHA256 over the raw handshake bytes |
| Encryption | XChaCha20-Poly1305, a random 24-byte nonce per message |
| Code | 6 characters from a 32-character alphabet, from `Random.secure` |

The implementation is the `cryptography` package, with `cryptography_flutter` selecting a platform implementation where one exists. A bug in that package is a bug in ShareGo. Keep it updated.

## Memory

Derived AEAD keys are `SecretKeyData` created with `overwriteWhenDestroyed: true`, so `destroy()` zeroes those bytes. The X25519 private key is held by `SimpleKeyPairData`. That type's `destroy()` drops the reference and does not overwrite the bytes, because the package does not expose an overwrite flag for it. Wiping the private key is best-effort. Do not treat process memory as gone until the process exits.

## Trust limits of the builds

The macOS disk image and the iOS ipa from CI are unsigned until an Apple Developer account is added. An unsigned download can be replaced in transit by whoever serves the file. Download from the project's GitHub Release, and compare the verification number on both devices even then. Android builds are signed with the release key only when the keystore secrets are configured. Otherwise they use the CI debug key, which changes between runners.
