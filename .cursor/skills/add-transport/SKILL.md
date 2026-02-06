---
name: add-transport
description: Guide for implementing a new transport layer for ShareGo (e.g. WebRTC, Bluetooth). Use when adding a new transport implementation, working on the transport interface, or when the user asks about transport portability.
---

# Adding a new transport

ShareGo uses the `ILocalTransport` interface to abstract the network layer. This allows swapping WebSocket for WebRTC (or anything else) without changing crypto, protocol, or session logic.

## Steps

1. **Create a new file** in `core/src/transport/` (e.g. `webrtc-transport.ts`)

2. **Implement `ILocalTransport`** from `core/src/transport/types.ts`:

```typescript
import type { ILocalTransport, TransportState, TransportStateCallback, MessageCallback } from "./types.js";

export class WebRTCTransport implements ILocalTransport {
  async listen(port: number): Promise<void> { /* ... */ }
  async connect(addr: string): Promise<void> { /* ... */ }
  send(data: Uint8Array): void { /* ... */ }
  onMessage(cb: MessageCallback): void { /* ... */ }
  onStateChange(cb: TransportStateCallback): void { /* ... */ }
  close(): void { /* ... */ }
  getState(): TransportState { /* ... */ }
  getLocalAddress(): string | null { /* ... */ }
}
```

3. **Key requirements**:
   - `listen()` = receiver role (wait for incoming connection)
   - `connect()` = sender role (connect to receiver)
   - Only one peer per transport (2-user session limit)
   - Reject additional connections after the first peer
   - Fire `onStateChange` callbacks on every state transition
   - `send()` must throw if no peer is connected
   - `close()` must release all resources

4. **Export** from `core/src/transport/index.ts`

5. **Test** by wiring it into a `Session` and running the handshake

## Checklist

- [ ] Implements all `ILocalTransport` methods
- [ ] Rejects second peer connection
- [ ] Fires state callbacks: idle -> listening/connected -> disconnected -> closed
- [ ] `send()` throws when no peer connected
- [ ] `close()` releases all resources
- [ ] Exported from transport barrel
- [ ] Works on all target platforms for this transport type
