---
name: add-message-type
description: Guide for adding a new protocol message type to ShareGo. Use when extending the wire protocol with a new message type.
---

# Adding a new message type

the ShareGo protocol uses typed JSON messages over WebSocket. adding a new message type requires changes in the core library and documentation.

## Steps

### 1. Add the type to the enum

file: `core/src/protocol/types.ts`

```typescript
export enum MessageType {
  // ... existing types
  PING = "PING",  // your new type
}
```

### 2. Define the message interface

file: `core/src/protocol/types.ts`

```typescript
export interface PingMessage extends BaseMessage {
  type: MessageType.PING;
  timestamp: number;
}
```

### 3. Add to the union

file: `core/src/protocol/types.ts`

```typescript
export type ProtocolMessage =
  | HelloMessage
  | ChallengeMessage
  // ... existing
  | PingMessage;  // add here
```

### 4. Update serialization validation

file: `core/src/protocol/serialization.ts`

add a case for the new type in `deserializeMessage()` to validate required fields:

```typescript
case MessageType.PING:
  if (typeof parsed.timestamp !== "number") {
    throw new Error("PING: missing timestamp");
  }
  break;
```

### 5. Handle in session

file: `core/src/session/session.ts`

add a case in `handleIncoming()`:

```typescript
case MessageType.PING:
  this.handlePing(msg as PingMessage);
  break;
```

### 6. Export if needed

if the new message type needs to be used by app shells, export it from:
- `core/src/protocol/index.ts`
- `core/src/index.ts`

### 7. Add tests

file: `core/src/protocol/serialization.test.ts`

```typescript
it("should roundtrip PING message", () => {
  const msg: PingMessage = {
    ...createBaseFields(MessageType.PING, "ABC123", 1),
    timestamp: Date.now(),
  };
  const bytes = serializeMessage(msg);
  const parsed = deserializeMessage(bytes);
  expect(parsed.type).toBe(MessageType.PING);
});
```

### 8. Update documentation

- `docs/PROTOCOL.md` — add the message spec, fields table, and example JSON
- `docs/THREAT_MODEL.md` — add security implications if the message carries sensitive data
- `.cursor/rules/sharego-protocol.mdc` — update if wire format changes

## Security checklist

- [ ] new message does NOT carry plaintext sensitive data (passwords, OTPs)
- [ ] if it carries binary data, it uses AEAD encryption like DATA messages
- [ ] sequence number is required and validated
- [ ] protocol version is checked
- [ ] session ID is validated
- [ ] unknown/unexpected messages of this type are rejected, not ignored
- [ ] no new fields leak key material or internal state

## Checklist

- [ ] enum value added to `MessageType`
- [ ] interface defined extending `BaseMessage`
- [ ] added to `ProtocolMessage` union
- [ ] serialization validation added in `deserializeMessage()`
- [ ] handler added in `session.ts` `handleIncoming()`
- [ ] exported from barrel files (if needed by app shells)
- [ ] roundtrip test added
- [ ] `docs/PROTOCOL.md` updated with spec
- [ ] `docs/THREAT_MODEL.md` updated if security-relevant
