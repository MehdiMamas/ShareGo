---
name: security-review
description: Review ShareGo code changes for security issues and compliance with the threat model. Use when reviewing PRs, auditing code, or when the user asks for a security review of changes.
---

# Security review for ShareGo

## Review checklist

When reviewing any code change in ShareGo, check:

### Crypto

- [ ] Only libsodium is used for crypto — no platform APIs, no custom implementations
- [ ] Ephemeral keys generated fresh per session (`generateKeyPair()`)
- [ ] Keys are never persisted to disk, local storage, or databases
- [ ] `zeroMemory()` called on all key material when session ends
- [ ] Fresh random nonce per DATA message (24 bytes via `randombytes_buf`)
- [ ] AEAD used for all encryption (`xchacha20poly1305_ietf`)

### Protocol

- [ ] Protocol version checked on every deserialized message
- [ ] Sequence numbers validated (no duplicate or out-of-order)
- [ ] Session ID validated on every incoming message
- [ ] Unknown message types are rejected, not ignored
- [ ] No sensitive data in QR payload or pairing codes

### Session

- [ ] 2-user limit enforced (second connection rejected)
- [ ] Receiver approval required before session becomes active
- [ ] Bootstrap expiry checked before accepting connections
- [ ] Session TTL enforced
- [ ] `cleanup()` called on every exit path (close, reject, error, disconnect)

### Transport

- [ ] No internet fallback or cloud relay
- [ ] No data sent before handshake completes
- [ ] Transport errors trigger session cleanup
- [ ] Only `Uint8Array` crosses the transport boundary (no strings)

### General

- [ ] No `console.log` of secrets, keys, or sensitive data
- [ ] Constant-time comparison for any secret comparison
- [ ] Error messages do not leak secret material
- [ ] Changes documented in THREAT_MODEL.md if they affect the security surface

### Config & i18n

- [ ] Timing values (TTLs, timeouts) come from `core/src/config.ts`, not hardcoded
- [ ] User-facing text comes from `core/src/i18n/en.ts`, not hardcoded in app shells
- [ ] No sensitive data appears in translation strings or config constants

### Platform parity

- [ ] Changes applied to both desktop and mobile (if applicable)
- [ ] Platform adapters don't contain any crypto or protocol logic
- [ ] Both platforms use the same `SessionController` from core

## How to run a review

1. Read the diff carefully — focus on `core/` changes first
2. Walk through each checklist item above
3. For crypto changes: verify against `docs/THREAT_MODEL.md` crypto table
4. For protocol changes: verify against `docs/PROTOCOL.md` message specs
5. For transport changes: verify the `ILocalTransport` interface contract
6. Flag any item that fails with a clear explanation of the risk

## Reference

- Full threat model: `docs/THREAT_MODEL.md`
- Crypto primitives: `core/src/crypto/crypto.ts`
- Protocol spec: `docs/PROTOCOL.md`
- Rejected alternatives: `docs/REJECTED.md`
- Config constants: `core/src/config.ts`
- Translation strings: `core/src/i18n/en.ts`
- Session controller: `core/src/session/session-controller.ts`
