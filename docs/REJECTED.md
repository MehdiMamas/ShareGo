# Replaced designs

The first ShareGo was a pnpm monorepo: a TypeScript core, an Electron desktop shell, and a React Native app that tried to share one UI. That stack is gone. The protocol, discovery, and packaging were split across too many runtimes for one person to keep working.

This tree is a single Flutter app. The protocol is version 2 (TCP and a shorter handshake). See [PROTOCOL.md](PROTOCOL.md).

Ideas that stay rejected:

- A cloud relay, TURN, or any fallback off the local network.
- More than two devices in a session.
- Putting the secret in the QR code.
- Persisting keys or messages.
- A second UI toolkit per platform. Platform differences are limited to permissions, the camera scanner, and the binary each store installs.
