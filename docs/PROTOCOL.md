# ShareGo — Protocol Specification

Version: 1

## Overview

The ShareGo protocol defines how two devices on the same local network establish a secure session and exchange sensitive data. It operates entirely on LAN with no internet dependency.

The protocol has two phases:
1. **Bootstrap** — session creation and peer discovery (QR code or manual code)
2. **Wire protocol** — handshake, authentication, encrypted data transfer, and teardown

## Bootstrap (session creation)

Bootstrap is how the sender learns the receiver's address and public key. It is NOT a data channel — no sensitive data flows through bootstrap.

### Mode 1: QR code

Used when a phone is involved (phone has a camera).

1. Receiver creates a session and generates an ephemeral X25519 key pair
2. Receiver starts listening on a local port
3. Receiver displays a QR code containing:

```json
{
  "v": 1,
  "sid": "A7K3M2",
  "addr": "192.168.1.10:4040",
  "pk": "<receiver_ephemeral_pubkey_base64>",
  "exp": 10
}
```

| Field  | Type   | Description                              |
|--------|--------|------------------------------------------|
| `v`    | number | Protocol version (always 1)              |
| `sid`  | string | Session ID (6-char alphanumeric)         |
| `addr` | string | Receiver's LAN IP and port               |
| `pk`   | string | Receiver's ephemeral X25519 public key   |
| `exp`  | number | QR expiry in seconds from creation (default: 10) |

> **Auto-regeneration:** when the QR expires (default 10 seconds), the receiver automatically generates a new session with fresh keys and displays a new QR code. This limits the window for QR code leakage without requiring user intervention. The overall session TTL is 300 seconds (5 minutes).

4. Sender (phone) scans the QR code
5. Sender extracts address and public key, connects via WebSocket
6. Wire protocol handshake begins

### Mode 2: Manual pairing code

Used for laptop-to-laptop (no camera available).

1. Receiver creates a session and generates an ephemeral X25519 key pair
2. Receiver starts listening on a local port
3. Receiver displays a 6-character alphanumeric code (the session ID): `A7K3M2`
4. Sender types the code into their app
5. Sender enters the receiver's address (ip:port) displayed alongside the session code
6. Sender connects via WebSocket
7. Wire protocol handshake begins (public keys exchanged in HELLO/CHALLENGE)

In this mode, the receiver's public key is NOT pre-shared — it is exchanged during the handshake. Both sides must explicitly confirm the pairing.

## Wire protocol

All messages are UTF-8 JSON, sent as binary WebSocket frames.

### Common fields

Every message includes:

| Field  | Type   | Description                                 |
|--------|--------|---------------------------------------------|
| `v`    | number | Protocol version                            |
| `type` | string | Message type (see below)                    |
| `sid`  | string | Session ID                                  |
| `seq`  | number | Monotonic sequence number (replay detection)|

### Message types

#### HELLO (sender -> receiver)

Sender initiates the handshake.

```json
{
  "v": 1,
  "type": "HELLO",
  "sid": "A7K3M2",
  "seq": 1,
  "pk": "<sender_ephemeral_pubkey_base64>",
  "deviceName": "Mehdi's iPhone"
}
```

#### CHALLENGE (receiver -> sender)

Receiver sends a random nonce and its public key (for Mode 2 where pk wasn't pre-shared via QR).

```json
{
  "v": 1,
  "type": "CHALLENGE",
  "sid": "A7K3M2",
  "seq": 1,
  "nonce": "<random_32_bytes_base64>",
  "pk": "<receiver_ephemeral_pubkey_base64>"
}
```

#### AUTH (sender -> receiver)

Sender proves key possession by encrypting the challenge nonce with the derived shared key.

```json
{
  "v": 1,
  "type": "AUTH",
  "sid": "A7K3M2",
  "seq": 2,
  "proof": "<nonce_concatenated_with_encrypted_challenge_base64>"
}
```

The `proof` field is: `nonce (24 bytes) || ciphertext` — the challenge nonce encrypted with XChaCha20-Poly1305 using the shared key.

#### ACCEPT (receiver -> sender)

Receiver approves the pairing after verifying the proof.

```json
{
  "v": 1,
  "type": "ACCEPT",
  "sid": "A7K3M2",
  "seq": 2
}
```

#### REJECT (receiver -> sender)

Receiver denies the pairing.

```json
{
  "v": 1,
  "type": "REJECT",
  "sid": "A7K3M2",
  "seq": 2,
  "reason": "authentication failed"
}
```

#### DATA (either -> either)

Encrypted payload. Used for passwords, OTPs, and short text.

```json
{
  "v": 1,
  "type": "DATA",
  "sid": "A7K3M2",
  "seq": 3,
  "ciphertext": "<encrypted_payload_base64>",
  "nonce": "<24_byte_nonce_base64>"
}
```

Encryption: XChaCha20-Poly1305 with the derived shared key. Each DATA message uses a fresh random nonce.

#### ACK (receiver of DATA -> sender of DATA)

Delivery confirmation.

```json
{
  "v": 1,
  "type": "ACK",
  "sid": "A7K3M2",
  "seq": 4,
  "ackSeq": 3
}
```

#### CLOSE (either -> either)

Session teardown. Both sides zero secrets after receiving or sending CLOSE.

```json
{
  "v": 1,
  "type": "CLOSE",
  "sid": "A7K3M2",
  "seq": 5
}
```

## Session lifecycle

```
[Receiver]                              [Sender]
    |                                       |
    |-- creates session, listens ---------->|
    |   (displays QR or code)               |
    |                                       |
    |<-------------- connects --------------|
    |<-------------- HELLO -----------------|
    |                                       |
    |-- CHALLENGE (nonce + pk) ------------>|
    |                                       |
    |<-------------- AUTH (proof) ----------|
    |                                       |
    |-- verifies proof                      |
    |-- shows approval prompt               |
    |                                       |
    |-- ACCEPT or REJECT ------------------>|
    |                                       |
    |   [session active — data can flow]    |
    |                                       |
    |<-------------- DATA ------------------|
    |-- ACK -------------------------------->|
    |                                       |
    |-- DATA ------------------------------>|
    |<-------------- ACK ------------------|
    |                                       |
    |-- CLOSE (or) ----------------------->|
    |<-------------- CLOSE ----------------|
    |                                       |
    |   [secrets zeroed, transport closed]  |
```

## Session rules

1. **Exactly 2 participants** — the receiver rejects any connection after the first sender joins
2. **No late join** — once a session is active, no new participants can be added. Create a new session instead.
3. **Bootstrap expiry** — QR codes and manual codes expire (default 10 seconds). After expiry, the receiver auto-regenerates a new session with fresh keys.
4. **Session TTL** — sessions expire after a configurable time (default 5 minutes) regardless of activity.
5. **One-use bootstrap** — a QR code or manual code can only be used once. After the first sender connects, the bootstrap is invalidated.
6. **Receiver approval** — the receiver must explicitly approve or reject every pairing request. There is no auto-accept.
7. **Sequence numbers** — each message has a monotonically increasing sequence number. Messages with unexpected sequence numbers are rejected (replay detection).

## QR is never a data channel

The QR code contains only bootstrap information (address, public key, session ID). It is never used to transmit passwords, OTPs, or any sensitive data. All sensitive data flows over the encrypted WebSocket connection after the handshake is complete.

## Configuration defaults

These values are defined in `core/src/config.ts` and are the single source of truth:

| Constant               | Value     | Description                                 |
|------------------------|-----------|---------------------------------------------|
| `BOOTSTRAP_TTL`        | 10s       | QR/code expiry before auto-regeneration     |
| `SESSION_TTL`          | 300s      | Maximum session lifetime                    |
| `DEFAULT_PORT`         | 4040      | WebSocket server port                       |
| `SESSION_CODE_LENGTH`  | 6         | Length of the alphanumeric session code      |
| `WS_CONNECT_TIMEOUT_MS`| 10000ms   | WebSocket connection timeout                |
| `MAX_MESSAGE_SIZE`     | 65536     | Maximum WebSocket message size (64 KB)      |
| `MAX_SEQ_GAP`          | 100       | Maximum allowed gap in sequence numbers     |
