# ShareGo — Architecture

## What is ShareGo

ShareGo is a serverless, end-to-end encrypted, local-network-only app for securely sharing sensitive data (passwords, OTPs, short text) between exactly two devices on the same Wi-Fi network.

No cloud servers. No relay. No signaling. No internet required.

## Supported platforms

ShareGo runs on all five major platforms from a single shared core:

| Platform | Shell             | Build target       |
| -------- | ----------------- | ------------------ |
| Windows  | Electron          | .exe / .msi (NSIS) |
| macOS    | Electron          | .dmg / .app        |
| Linux    | Electron          | .AppImage / .deb   |
| Android  | React Native bare | Native APK/AAB     |
| iOS      | React Native bare | Native IPA         |

All platforms share a unified React Native + react-native-web codebase in `apps/app/`. The TypeScript core (crypto, protocol, session, transport) lives in `@sharego/core`. Desktop uses Electron for the native shell (Node.js main process for WebSocket server, mDNS). Mobile uses React Native bare.

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
9. **Auto-regenerating bootstrap** — QR codes and session codes expire after 30 seconds and auto-regenerate with fresh keys. Sessions expire after 5 minutes total.

## Tech stack decisions

### Shared core: TypeScript

One implementation of crypto, protocol, session logic, and transport abstraction. No duplicated security logic across platforms.

- Crypto: `libsodium-wrappers-sumo` (browser/Node compatible, audited)
- Protocol: binary DATA frames + JSON control messages
- Session: XState v5 state machine + event emitter + framework-agnostic `SessionController`
- Transport: `ILocalTransport` interface, v1 = WebSocket
- Discovery: `DiscoveryAdapter` interface (mDNS preferred, subnet scan fallback)
- Types: branded types for compile-time safety (`SessionId`, `NetworkAddress`, `Base64PublicKey`, etc.)
- Config: shared constants in `core/src/config.ts` (TTLs, ports, limits)
- Logger: pluggable `Logger` interface in `core/src/logger.ts` — replaces silent catches
- i18n: all user-facing text in `core/src/i18n/en.ts` (single source of truth for both platforms)

### Desktop: Electron (Windows, macOS, Linux)

- Node.js main process runs WebSocket server and mDNS discovery natively
- Renderer process uses react-native-web for UI parity with mobile
- Webcam-based QR scanning via html5-qrcode (fallback: manual pairing code)
- Packaged via electron-builder for all three desktop OSes
- IPC bridge (contextBridge + ipcRenderer/ipcMain) for secure renderer↔main communication

### Mobile: React Native bare (Android, iOS)

- No Expo managed workflow — bare gives full control over native modules
- Camera access for QR scanning via react-native-vision-camera
- Local network access (LAN WebSocket)
- mDNS discovery via react-native-zeroconf
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
      crypto/           libsodium wrappers, key exchange, encrypt/decrypt, constantTimeEqual
      protocol/         message types, serialization, validation, binary DATA frames
      session/          XState state machine, session controller, events
      transport/        ILocalTransport interface + WebSocketTransport
      discovery/        DiscoveryAdapter interface, mDNS + subnet fallback
      types/            branded types (SessionId, NetworkAddress, etc.)
      i18n/             translation resources (en.ts) — single source of truth
      config.ts         shared constants (TTLs, ports, limits) — single source of truth
      logger.ts         pluggable Logger interface (setLogger, log.debug/warn/error)
      index.ts          barrel export
    package.json
    tsconfig.json
    vitest.config.ts
  apps/
    app/                unified app (desktop + mobile)
      electron/         Electron main process (ws-server, net-utils, mdns-adapter, preload)
        package.json    runtime-only deps for Electron main process (ws, bonjour-service)
      src/
        adapters/       platform adapters (transport, clipboard, network)
        components/     shared React Native components
        hooks/          useSession, useTransport
        screens/        HomeScreen, ReceiveScreen, SendScreen, ActiveSessionScreen
        styles/         theme.ts (shared design tokens)
        types/          web.d.ts (RN ViewStyle augmentation for react-native-web)
        lib/            core re-exports
        platform.ts     runtime platform detection
        App.tsx         entry point
      e2e/              Playwright tests (Electron E2E)
      e2e-mobile/       Detox tests (mobile E2E)
      package.json
  scripts/
    setup.sh            one-command dev environment setup
    dev-ios.sh          iOS simulator/device convenience script
    build-ios.sh        iOS production build
    build-android.sh    Android production build
    build-desktop.sh    Electron desktop build
    build-core.sh       core library build
    check.sh            prerequisite checker for all platforms
    preflight.sh        pre-build validation
    sync-version.mjs    version synchronization across packages
  docs/
    ARCHITECTURE.md     this file
    BUILDING.md         build instructions for all platforms
    CONTRIBUTING.md     contribution guidelines and code standards
    IOS_GUIDE.md        complete iOS setup, device deployment, troubleshooting
    PROTOCOL.md         wire format, message types, session lifecycle
    THREAT_MODEL.md     threats, mitigations, crypto choices
    REJECTED.md         why NOT certain alternatives
  .github/
    workflows/          CI/CD (release builds for all platforms)
  turbo.json            Turborepo task pipeline
  package.json          monorepo root (pnpm workspaces + turbo)
  pnpm-workspace.yaml   workspace package definitions
  .npmrc                pnpm config (hoisted node_modules for react native)
  tsconfig.base.json    shared TypeScript config
  SECURITY.md           vulnerability reporting policy
  CODE_OF_CONDUCT.md    contributor code of conduct
  LICENSE               MIT license
```

## Platform-specific notes

### Windows

- Electron bundles Chromium — no system webview dependency
- Node.js main process runs WebSocket server (ws library)
- No special permissions needed for LAN access

### macOS

- Electron app, signed for distribution
- Node.js main process handles WebSocket server and mDNS (bonjour-service)
- For App Store: local network entitlements needed

### Linux

- Electron app, distributed as AppImage or .deb
- No special permissions for LAN access

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
6. **Feature and UI parity** — desktop and mobile must be identical in features, behavior, and appearance
7. **Centralized strings** — all user-facing text lives in `core/src/i18n/en.ts`, never hardcoded in app shells
