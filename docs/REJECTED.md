# ShareGo — Rejected alternatives

This document explains why certain technologies, architectures, and approaches were explicitly rejected. This is not a "we didn't think of it" list — it is a "we considered it and said no" list. The purpose is to prevent future "just this once" backsliding.

## Firebase / cloud signaling servers

**Why considered:** Firebase Realtime Database or Firestore could act as a signaling channel to help devices find each other without being on the same network.

**Why rejected:**
- Violates the "no cloud servers" invariant
- Introduces a third party that can observe connection metadata (who is connecting to whom, when, how often)
- Creates a dependency on Google infrastructure — if Firebase is down, the app breaks
- Opens the door to "just relay through Firebase" when LAN discovery fails
- Even metadata (IP addresses, connection timestamps) is sensitive for a security-focused app

**Verdict:** No cloud services, period. If devices can't find each other on LAN, the app shows an error — it does not fall back to the internet.

## Expo managed workflow

**Why considered:** Expo simplifies React Native development significantly — easier builds, OTA updates, managed native modules.

**Why rejected:**
- Expo managed does not give full control over native modules
- Local network server (WebSocket listener) requires native code that Expo managed may not support or may break on updates
- Camera + LAN + clipboard + memory control all require native module access
- Expo's OTA update mechanism is a security concern — an update could be intercepted or tampered with
- Bare React Native gives full control, which is necessary for a security-focused app

**Verdict:** React Native bare workflow only. No Expo managed.

## Bluetooth

**Why considered:** Bluetooth could enable device-to-device transfer without Wi-Fi.

**Why rejected:**
- Bluetooth pairing UX is terrible and inconsistent across platforms
- Bluetooth throughput is low (even for short text, the pairing overhead is significant)
- Bluetooth APIs are significantly different on iOS, Android, Windows, macOS, and Linux — no unified abstraction
- Bluetooth discoverability is a privacy concern
- Wi-Fi is universally available in the scenarios where ShareGo is useful (office, home, meeting)

**Verdict:** Wi-Fi only. Bluetooth adds complexity without meaningful benefit.

## NFC

**Why considered:** NFC tap could bootstrap a session instantly.

**Why rejected:**
- Not available on all platforms (most laptops lack NFC)
- iOS NFC is heavily restricted (background tag reading only in certain modes)
- NFC range is too short for practical use (devices must physically touch)
- QR code scanning provides the same "bootstrap" functionality with better range and universal support

**Verdict:** QR and manual code cover all platforms. NFC does not.

## Cloud relay fallback

**Why considered:** When LAN discovery fails (e.g., devices on different VLANs, AP isolation), a cloud relay could forward encrypted packets.

**Why rejected:**
- Violates the "no cloud servers" invariant
- Even if data is E2E encrypted, the relay server sees metadata (IPs, timing, packet sizes)
- Creates infrastructure cost and maintenance burden
- If the relay is ever compromised, it becomes a traffic analysis point
- "Fallback" mechanisms tend to become "default" over time
- The correct response to LAN failure is: tell the user to check their network, not silently route through the internet

**Verdict:** No relay. If LAN doesn't work, the app fails explicitly. Users should fix their network, not trust a cloud relay.

## Platform-specific crypto APIs

**Why considered:** iOS Keychain, Android Keystore, Windows DPAPI, and macOS Keychain offer hardware-backed key storage and crypto operations.

**Why rejected:**
- ShareGo uses ephemeral keys that are never persisted — key storage is not needed
- Platform crypto APIs differ in behavior, algorithm support, and error handling across 5 platforms
- Using platform crypto would mean 5 different crypto implementations instead of 1
- libsodium provides consistent behavior across all platforms
- Platform secure enclaves are designed for long-lived keys, not ephemeral session keys

**Verdict:** libsodium for all crypto. One implementation, all platforms.

## WebRTC for v1

**Why considered:** WebRTC DataChannel provides built-in encryption (DTLS-SRTP) and peer-to-peer connectivity.

**Why rejected for v1:**
- WebRTC's encryption is not under our control — we cannot audit or customize it
- WebRTC on LAN still works, but the setup complexity (ICE, SDP exchange) is overkill for same-network devices
- WebSocket is simpler, more debuggable, and universally supported
- We already encrypt at the application layer with libsodium — WebRTC's built-in encryption is redundant

**Why kept for v2:** WebRTC DataChannel could be useful for future scenarios (e.g., devices behind different NATs on the same network). The `ILocalTransport` interface allows it as a drop-in replacement without changing the protocol.

**Verdict:** WebSocket for v1. WebRTC as a future v2 transport option.

## Electron

**Why considered:** Electron is the most popular cross-platform desktop framework with the largest ecosystem.

**Why rejected:**
- Electron bundles Chromium — massive binary size (100MB+) for an app that transfers text
- Larger attack surface (full browser engine)
- Higher memory usage
- Tauri uses the system webview, resulting in 5-10MB binaries and much smaller attack surface
- For a security-focused app, minimizing attack surface is a priority

**Verdict:** Tauri for desktop. Smallest binary, smallest attack surface.

## Flutter

**Why considered:** Flutter covers mobile and desktop from a single Dart codebase.

**Why rejected:**
- Dart ecosystem for crypto is less mature than TypeScript/libsodium
- Flutter desktop is less mature than Tauri for native system access
- TypeScript core is more widely auditable (more developers can review it)
- React Native (mobile) + Tauri (desktop) + shared TypeScript core gives better platform-specific control

**Verdict:** TypeScript core with Tauri + React Native shells.
