# ShareGo

serverless, end-to-end encrypted, local-network-only sharing for sensitive data between two devices on the same Wi-Fi.

no cloud. no relay. no signaling. no internet required.

## what it does

share passwords, OTPs, and sensitive text between exactly two devices on the same network. receiver creates a session, sender scans a QR code or enters a manual code, receiver approves, and data flows — encrypted end-to-end with ephemeral keys that never touch disk.

## platforms

| platform | shell | status |
|----------|-------|--------|
| windows | tauri v2 | code complete |
| macOS | tauri v2 | code complete |
| linux | tauri v2 | code complete |
| android | react native bare | code complete |
| iOS | react native bare | code complete |

## how it works

```
receiver                          sender
   |                                |
   |  create session, show QR      |
   |  <--------------------------  |  scan QR or enter code
   |                                |
   |  HELLO (sender public key)    |
   |  <--------------------------  |
   |                                |
   |  CHALLENGE (nonce + recv pk)  |
   |  -------------------------->  |
   |                                |
   |  AUTH (encrypted nonce proof) |
   |  <--------------------------  |
   |                                |
   |  ACCEPT / REJECT             |
   |  -------------------------->  |
   |                                |
   |  DATA <-> ACK (encrypted)    |
   |  <========================>  |
   |                                |
   |  CLOSE                        |
   |  <========================>  |
```

## security

- **crypto**: X25519 key exchange, XChaCha20-Poly1305 AEAD encryption (libsodium)
- **keys**: ephemeral per session, never persisted, zeroed on close
- **transport**: local WebSocket on LAN only — no internet traffic
- **participants**: exactly 2 per session, receiver must approve sender
- **replay protection**: monotonic sequence numbers on every message

see [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md) for the full threat analysis.

## project structure

```
core/               shared typescript library (crypto, protocol, session, transport)
apps/
  desktop-tauri/    tauri v2 desktop app (rust backend + react frontend)
  mobile-rn/        react native bare mobile app (android + iOS)
docs/               architecture, protocol spec, threat model, rejected alternatives
```

all security logic lives in `@sharego/core`. app shells are thin wrappers that provide platform-specific APIs (websocket server, camera, clipboard) and UI.

## quick start

```bash
git clone <repo-url> ShareGo
cd ShareGo
npm install
npm run build:core
```

see [BUILD.md](BUILD.md) for platform-specific build instructions.

## docs

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — system design and platform notes
- [PROTOCOL.md](docs/PROTOCOL.md) — wire format, message types, session lifecycle
- [THREAT_MODEL.md](docs/THREAT_MODEL.md) — threats, mitigations, crypto surface
- [BUILDING.md](docs/BUILDING.md) — detailed build instructions per platform
- [REJECTED.md](docs/REJECTED.md) — why not cloud, expo, electron, bluetooth, etc.
- [CONTRIBUTING.md](docs/CONTRIBUTING.md) — contribution guidelines
