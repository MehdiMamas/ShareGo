# Contributing to ShareGo

## Before you start

Read these documents first:

- `docs/ARCHITECTURE.md` — understand the stack and invariants
- `docs/PROTOCOL.md` — understand the wire format and session lifecycle
- `docs/THREAT_MODEL.md` — understand what we protect against
- `docs/REJECTED.md` — understand what we explicitly chose not to use

## Project invariants

These are non-negotiable. Do not submit changes that violate them:

1. No cloud servers, relay, or internet fallback
2. Same Wi-Fi / local network only
3. Exactly 2 participants per session
4. All crypto via libsodium only
5. Ephemeral keys — never persisted
6. Supports all 5 platforms: Windows, macOS, Linux, Android, iOS
7. Feature and UI parity between desktop and mobile — no exceptions
8. All user-facing text in `core/src/i18n/en.ts` — never hardcoded in app shells
9. All timing/config values in `core/src/config.ts` — never hardcoded in app code

## Code standards

### TypeScript

- Use `type` imports for type-only imports
- Always include `.js` extension in relative imports (ESM)
- Use `Uint8Array` for binary data, never `Buffer`
- Prefer `const` over `let`
- Explicit return types on all exported functions
- Comments are lowercase, only when explaining _why_

### Naming

- Interfaces: `ILocalTransport` (only for contracts/adapters)
- Types: `PascalCase` (e.g. `ProtocolMessage`, `SessionState`)
- Functions: `camelCase` (e.g. `deriveSharedSecret`, `createBaseFields`)
- Constants: `UPPER_SNAKE_CASE` (e.g. `PROTOCOL_VERSION`)
- Files: `kebab-case` (e.g. `websocket-transport.ts`)

### Testing

- Tests go in `*.test.ts` files next to the module
- Use vitest (`describe`, `it`, `expect`)
- Test state transitions explicitly
- Never use direct SQL or database calls in tests
- Run: `pnpm test` from the `core/` directory

## Making changes

### Core changes (`core/`)

1. All security-critical logic lives here
2. Never duplicate crypto or protocol logic into app shells
3. If you change the protocol, update `docs/PROTOCOL.md`
4. If you change the security surface, update `docs/THREAT_MODEL.md`
5. Run `npx tsc --noEmit` before committing — zero errors required

### Transport changes

See `.cursor/skills/add-transport/SKILL.md` for adding a new transport.

### App shell changes (`apps/`)

App shells are thin wrappers. They should:

- Provide platform-native WebSocket server/client adapters
- Provide UI (React Native + react-native-web for all platforms)
- Provide platform permissions (camera, local network)
- **Not** contain any crypto or protocol logic
- **Not** hardcode user-facing text — use translations from `core/src/i18n/en.ts`
- **Not** hardcode timing or config values — use constants from `core/src/config.ts`

**UI parity rule:** when changing any screen, component, or behavior on one platform, you must apply the equivalent change to the other platform. See `.cursor/rules/ui-parity.mdc` for details.

## Pull request process

1. Branch from `main` (the default branch)
2. Make your changes
3. Run type check: `cd core && npx tsc --noEmit`
4. Run tests: `cd core && pnpm test`
5. Update docs if you changed protocol, security, or architecture
6. Open a PR with:
   - Summary of what changed and why
   - Which platforms are affected
   - Security review checklist (see `.cursor/skills/security-review/SKILL.md`)

## Security review

Every PR that touches `core/` should be reviewed against the security checklist in `.cursor/skills/security-review/SKILL.md`. If you are adding a new message type, transport, or changing the handshake, the change requires extra scrutiny.

## What not to do

- Do not add cloud services or fallbacks (see `docs/REJECTED.md`)
- Do not use Expo managed workflow
- Do not use platform-specific crypto
- Do not persist keys or secrets
- Do not add dependencies without justification
- Do not bypass receiver approval for pairing
- Do not hardcode user-facing text in JSX — always use i18n translations
- Do not hardcode timing or config values — always import from `core/src/config.ts`
- Do not add features to one platform without adding them to the other
- Do not add `console.log` of secrets, keys, or sensitive data
