---
name: debug-session
description: Guide for debugging ShareGo session issues. Use when troubleshooting connection failures, handshake problems, state machine issues, or data transfer errors.
---

# Debugging session issues

## Common issues and where to look

### Session won't start (receiver)

1. check `transport.getState()` — should be `"listening"` after `startAsReceiver()`
2. check `transport.getLocalAddress()` — must return a valid `ip:port`
3. on mobile: ensure local network permission is granted (iOS) or INTERNET permission exists (Android)
4. on desktop: check if port 4040 is already in use

**files to check:**
- `core/src/session/session.ts` — `startAsReceiver()`
- `core/src/transport/websocket-transport.ts` — `listen()`
- desktop: `apps/app/src/adapters/electron-ws-server.ts`
- mobile: `apps/app/src/adapters/rn-ws-server.ts`

### Sender can't connect

1. verify both devices are on the same Wi-Fi network
2. check the address format: should be `ip:port` (e.g. `192.168.1.10:4040`)
3. check `WS_CONNECT_TIMEOUT_MS` (10 seconds) — connection may be timing out
4. if using discovery: check `DISCOVERY_HOST_TIMEOUT_MS` (1.5 seconds per host)

**files to check:**
- `core/src/utils/discovery.ts` — `discoverReceiver()`
- `core/src/transport/websocket-transport.ts` — `connect()`
- desktop: `apps/app/src/adapters/web-ws-client.ts`
- mobile: `apps/app/src/adapters/rn-ws-client.ts`

### Handshake fails

1. check that both sides have initialized libsodium: `await initCrypto()`
2. verify the key exchange: receiver sends CHALLENGE with pk, sender proves with AUTH
3. check `deriveSharedSecret()` — both sides must derive the same shared key
4. verify sequence numbers are correct (HELLO=1, AUTH=2, etc.)

**files to check:**
- `core/src/session/session.ts` — `handleHello()`, `handleChallenge()`, `handleAuth()`
- `core/src/crypto/crypto.ts` — `deriveSharedSecret()`, `encrypt()`, `decrypt()`

### State machine stuck

1. check `VALID_TRANSITIONS` in `core/src/session/types.ts`
2. verify the current state allows the expected transition
3. check if `cleanup()` was called prematurely (resets to Closed)
4. check for errors in the `SessionEvent.Error` handler

**diagnostic steps:**
```typescript
// add temporary logging in session.ts handleIncoming():
console.log(`[session] state=${this.state} received=${msg.type} seq=${msg.seq}`);
```

### Data not decrypting

1. verify both sides derived the same shared key (key exchange succeeded)
2. check that each DATA message uses a fresh random nonce
3. verify the nonce is 24 bytes and the ciphertext includes the AEAD tag
4. check `MAX_MESSAGE_SIZE` (64 KB) — message may exceed the limit

**files to check:**
- `core/src/crypto/crypto.ts` — `encrypt()`, `decrypt()`
- `core/src/session/session.ts` — `sendData()`, `handleData()`

### Auto-regeneration issues

the receiver auto-regenerates sessions every `BOOTSTRAP_TTL` (10 seconds):

1. check that `cleanup()` is called on the old session before starting a new one
2. verify new ephemeral keys are generated (not reusing old ones)
3. check `REGENERATION_DELAY_MS` (300ms) — there's a small delay between expiry and regeneration
4. verify the QR payload updates with the new session ID and public key

**files to check:**
- `apps/app/src/screens/ReceiveScreen.tsx` — regeneration effect
- `core/src/session/session-controller.ts` — `startReceiver()`, `cleanup()`

## State transition diagram

```
Created ──────────> WaitingForSender ──> Handshaking ──> PendingApproval ──> Active ──> Closed
  │                       │                  │                │
  └── Closed              └── Closed         ├── Active       ├── Rejected ──> Closed
                                             ├── Rejected     └── Closed
                                             └── Closed
```

## Useful commands

```bash
# run core tests to verify session logic
npm run test:core

# type-check core for compilation errors
cd core && npx tsc --noEmit

# check if port 4040 is in use
lsof -i :4040
```
