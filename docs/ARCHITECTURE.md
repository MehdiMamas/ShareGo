# ShareGo — Architecture

## What is ShareGo

ShareGo is a serverless, end-to-end encrypted, local-network-only app for securely sharing sensitive data (passwords, OTPs, short text) between exactly two devices on the same Wi-Fi network.

No cloud servers. No relay. No signaling. No internet required.

## Supported platforms

ShareGo runs on all five major platforms from a single shared core:

| Platform | Shell           | Build target              |
|----------|-----------------|---------------------------|
| Windows  | Tauri           | MSVC native binary        |
| macOS    | Tauri           | Universal binary (x64+ARM)|
| Linux    | Tauri           | AppImage / .deb           |
| Android  | React Native    | Native APK/AAB            |
| iOS      | React Native    | Native IPA                |

Desktop and mobile share the same TypeScript core (crypto, protocol, session, transport). Each platform shell is a thin wrapper that provides native APIs (WebSocket server, camera, clipboard) and a UI layer.

## Core invariants

These are non-negotiable constraints. If a platform cannot meet them, the platform is adapted — the model is not changed.

1. **No cloud servers** — no TURN, no signaling servers, no relay of any kind
2. **Same Wi-Fi / local network only** — devices must be on the same LAN
3. **Exactly 2 participants per session** — no late join, no "add user"
4. **Receiver creates session, sender joins** — receiver is always the listener
5. **End-to-end encrypted** — ephemeral keys, auditable crypto (libsodium)
6. **Ephemeral secrets, in-memory only** — keys are never persisted to disk
7. **v1: sensitive text only** — passwords, OTPs, short text. Files/images are a future extension.
8. **All 5 platforms** — Windows, macOS, Linux, Android, iOS

## Tech stack decisions

### Shared core: TypeScript

One implementation of crypto, protocol, session logic, and transport abstraction. No duplicated security logic across platforms.

- Crypto: `libsodium-wrappers-sumo` (browser/Node compatible, audited)
- Protocol: custom binary-over-JSON wire format
- Session: state machine with event emitter
- Transport: `ILocalTransport` interface, v1 = WebSocket

### Desktop: Tauri (Windows, macOS, Linux)

- Smallest attack surface of any desktop framework (no Chromium bundled engine, uses system webview)
- Native LAN access (WebSocket server/client)
- No camera needed on desktops — use manual pairing code or phone scans desktop QR
- Builds to native binary per OS

### Mobile: React Native bare (Android, iOS)

- No Expo managed workflow — bare gives full control over native modules
- Camera access for QR scanning
- Local network access (LAN WebSocket)
- Clipboard access with auto-clear capability
- Native builds per OS

### Transport v1: Local WebSocket

- Receiver listens on a port on LAN IP
- Sender connects using the address from QR or discovery
- No NAT traversal, no internet needed
- Simple, well-supported on all platforms

### Transport v2 (future): WebRTC DataChannel

- Same protocol, different transport
- Still serverless on LAN (no STUN/TURN needed for same-network)
- Drop-in replacement via `ILocalTransport` interface

## Repo structure

```
ShareGo/
  core/
    src/
      crypto/        libsodium wrappers, key exchange, encrypt/decrypt
      protocol/      message types, serialization, validation
      session/       session state machine, lifecycle, event emitter
      transport/     ILocalTransport interface + WebSocketTransport
      index.ts       barrel export
    package.json
    tsconfig.json
  apps/
    desktop-tauri/   Tauri shell + web UI (Windows, macOS, Linux)
    mobile-rn/       React Native bare app (Android, iOS)
  docs/
    ARCHITECTURE.md  this file
    PROTOCOL.md      wire format, message types, session lifecycle
    THREAT_MODEL.md  threats, mitigations, crypto choices
    REJECTED.md      why NOT certain alternatives
  package.json       monorepo root
  tsconfig.base.json shared TypeScript config
```

## Platform-specific notes

### Windows

- Tauri uses Edge WebView2 (preinstalled on Windows 10+)
- WebSocket server listens on all LAN interfaces
- No special permissions needed for LAN access

### macOS

- Tauri uses WKWebView (system-provided)
- App Sandbox: local network access is allowed by default for non-App Store distribution
- For App Store: `com.apple.security.network.client` and `com.apple.security.network.server` entitlements

### Linux

- Tauri uses WebKitGTK
- No special permissions for LAN access
- Distributable as AppImage (portable) or .deb

### Android

- React Native bare with native modules for WebSocket server
- Camera permission for QR scanning
- `android.permission.INTERNET` for local network (always granted)
- No special local network permission beyond INTERNET

### iOS

- React Native bare with native modules
- `NSCameraUsageDescription` for QR scanning
- `NSLocalNetworkUsageDescription` — iOS 14+ requires explicit local network permission
- User will see a system prompt: "ShareGo would like to find and connect to devices on your local network"
- Bonjour service type may be needed in Info.plist for discovery

## Design principles

1. **Security is not optional** — every design choice starts from the threat model
2. **One core, many shells** — all security logic lives in `@sharego/core`
3. **Transport is pluggable** — v1 WebSocket, v2 WebRTC, same interface
4. **No shortcuts** — no cloud fallback, no "just this once" relay
5. **Platform adapts to model** — if a platform can't meet an invariant, we work around the platform, not weaken the model
