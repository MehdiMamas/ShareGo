# Critical Review — ShareGo Codebase

> What I would do differently, and every workaround that should be replaced with a proper solution.

---

## 1. Architectural decisions I would change

### 1a. Two `package.json` files for the unified app

**Current state:** `apps/app/package.json` lists ALL dependencies for both Electron and React Native in a single `dependencies` field. This causes:

- Electron bundles 280MB of mobile-only packages (react-native, jsc-android, metro, @babel, etc.)
- Requires a massive `files` exclusion list in electron-builder config to compensate
- npm hoisting is unpredictable, requiring CI symlink workarounds

**What I would do instead:** Use a two-package.json structure:

- `apps/app/package.json` — only shared/mobile deps
- `apps/app/electron/package.json` — only Electron main-process deps (`ws`, `bonjour-service`)
- electron-builder would use `electron/package.json` for bundling, naturally excluding mobile packages
- No exclusion list needed, no symlink hacks in CI

### 1b. Platform adapter pattern for all platform-specific code

**Current state:** Platform-specific logic is scattered:

- Clipboard: inline `if (isElectron)` / `if (isMobile)` in `ActiveSessionScreen.tsx`
- IP detection: inline `if (isElectron)` / `if (isMobile)` in `SendScreen.tsx`
- Transport: properly abstracted via `useTransport` hook

**What I would do instead:** Every platform-specific capability gets an adapter:

```
adapters/
  clipboard.ts          — interface + web fallback
  clipboard.electron.ts — electron IPC implementation
  clipboard.native.ts   — react-native-clipboard implementation
  network.ts            — interface
  network.electron.ts   — electron IPC getLocalIp
  network.native.ts     — react-native-network-info
  transport/            — (already done properly)
```

Components would import from the adapter, never from platform-specific modules directly.

### 1c. Proper logging instead of console.log / silent catches

**Current state:** Error handling is almost universally "best effort" with empty catch blocks:

- `electron-ws-server.ts:56` — `.catch(() => {})`
- `rn-ws-server.ts:152, 221` — `catch { /* best effort */ }`
- `QRScanner.tsx:203, 237, 240` — `catch { /* best effort */ }`
- `ActiveSessionScreen.tsx:49, 57, 76` — silent clipboard failures
- `SendScreen.tsx:34, 45` — silent IP detection failures
- `ws-server.ts:74, 101` — silent WebSocket errors
- `session-controller.ts:70` — `catch { /* don't crash */ }`

**What I would do instead:** Create a `core/src/logger.ts` with a pluggable logger:

```typescript
export interface Logger {
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
}
let logger: Logger = console;
export function setLogger(l: Logger) {
  logger = l;
}
export function warn(msg: string, ...args: unknown[]) {
  logger.warn(msg, ...args);
}
export function error(msg: string, ...args: unknown[]) {
  logger.error(msg, ...args);
}
```

Every catch block would call `logger.warn()` instead of silently swallowing. This way:

- Development: errors are visible in console
- Production: errors can be routed to a crash reporter
- Tests: errors can be captured and asserted

---

## 2. Workarounds that should be replaced

### 2a. CI symlink hack for npm workspace hoisting

**File:** `.github/workflows/release.yml` lines 137-153
**Workaround:**

```yaml
- name: Fix monorepo node_modules resolution
  run: |
    if [ ! -d node_modules/react-native ]; then
      ln -sf .../apps/app/node_modules/react-native node_modules/react-native
    fi
    # ... more symlinks
```

**Why it's bad:** Fragile, breaks when new native deps are added, papers over the real problem.
**Proper fix:** Use `nohoist` in npm workspaces config, or switch to pnpm which has deterministic hoisting. Alternatively, pin React Native workspace deps at the root level.

### 2b. `@ts-expect-error` for CSS-in-RN height values

**File:** `apps/app/src/components/ScreenContainer.tsx` lines 45-48
**Workaround:**

```typescript
// @ts-expect-error -- 100vh is valid CSS but not in RN types
height: "100vh",
```

**Why it's bad:** TypeScript safety bypassed for every occurrence.
**Proper fix:** Create a `web.d.ts` declaration file:

```typescript
import "react-native";
declare module "react-native" {
  interface ViewStyle {
    height?: string | number;
    minHeight?: string | number;
  }
}
```

### 2c. Dynamic `require()` for React Native clipboard

**File:** `apps/app/src/screens/ActiveSessionScreen.tsx` line 46
**Workaround:**

```typescript
const RNClipboard = require("@react-native-clipboard/clipboard").default;
```

**Why it's bad:** No type safety, bundler can't tree-shake, eslint-disable needed.
**Proper fix:** Use the adapter pattern (see 1b above) with platform-specific imports resolved at build time.

### 2d. `setTimeout(r, 300)` delay for QR scanner initialization

**File:** `apps/app/src/components/QRScanner.tsx` line 191
**Workaround:**

```typescript
const startDelay = new Promise<void>((r) => setTimeout(r, 300));
```

**Why it's bad:** Arbitrary delay; might be too short on slow devices, wastes time on fast ones.
**Proper fix:** Use a MutationObserver or requestAnimationFrame loop to wait until the DOM container is actually rendered, then initialize html5-qrcode.

### 2e. `setTimeout` for scroll-to-end in message list

**File:** `apps/app/src/screens/ActiveSessionScreen.tsx` line 124
**Workaround:**

```typescript
setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
```

**Why it's bad:** Timing-dependent; race condition with React rendering.
**Proper fix:** Use `onContentSizeChange` prop on FlatList to scroll when content actually changes.

### 2f. Duplicate XState actor initialization

**File:** `core/src/session/session.ts` lines 97-99 and 112-118
**Workaround:** Actor is created at field declaration (line 97) then immediately overwritten in the constructor (line 112).
**Why it's bad:** The first initialization is wasted work and creates a confusing read.
**Proper fix:** Remove the field initializer; only initialize in the constructor.

### 2g. `eslint-disable-next-line` for exhaustive-deps

**File:** `apps/app/src/screens/ReceiveScreen.tsx` line 65
**Workaround:**

```typescript
// eslint-disable-next-line react-hooks/exhaustive-deps
```

**Why it's bad:** Hides a real dependency issue; effect may not re-run when it should.
**Proper fix:** Restructure the effect to properly declare dependencies, or use `useCallback` with correct deps and pass it to the effect.

### 2h. Manual video track cleanup for camera

**File:** `apps/app/src/components/QRScanner.tsx` lines 240-249
**Workaround:**

```typescript
const videos = document.querySelectorAll("video");
videos.forEach((video) => {
  const stream = video.srcObject;
  if (stream) stream.getTracks().forEach((track) => track.stop());
});
```

**Why it's bad:** Queries ALL video elements on the page, not just the scanner's. Could accidentally stop unrelated video streams.
**Proper fix:** Store a reference to the specific MediaStream from html5-qrcode and stop only those tracks. Or use html5-qrcode's `clear()` method which handles cleanup.

### 2i. Hardcoded libsodium path in Vite config

**File:** `apps/app/vite.config.ts` (libsodium CJS alias)
**Workaround:** Hardcoded relative path to `libsodium-wrappers-sumo/dist/modules/libsodium-sumo-wrappers.js`.
**Why it's bad:** Breaks if the package structure changes or hoisting changes.
**Proper fix:** Use `require.resolve()` to find the correct path dynamically, or configure Vite's `optimizeDeps` to handle the CJS module properly.

---

## 3. Race conditions that need fixing

### 3a. Connection handler registration race

**File:** `apps/app/src/adapters/electron-ws-server.ts`
**Issue:** `start()` subscribes to `ws:connection` IPC, then returns. Transport calls `onConnection()` after. If a peer connects in the gap, the connection is dropped.
**Current mitigation:** Added `pendingConnection` flag (recent fix).
**Proper fix:** The server adapter should buffer ALL events until the handler is set, not just the first one. Use an event queue.

### 3b. Crypto initialization race

**File:** `core/src/crypto/crypto.ts` lines 4-15
**Issue:** `initCrypto()` sets a global `ready` boolean after an async init. Multiple concurrent callers could pass `assertReady()` before init completes.
**Proper fix:** Make `assertReady()` return the initialization promise, or use a proper async lock.

### 3c. Subnet discovery resource cleanup

**File:** `core/src/discovery/discovery.ts` lines 155-206
**Issue:** WebSocket probe connections may not be cleaned up if the abort signal fires mid-scan.
**Proper fix:** Track all open sockets in a Set and close them all in the abort handler.

---

## 4. Dead code

| File                                             | What                                                                                 | Action                                   |
| ------------------------------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------- |
| `apps/app/src/components/CodeInput.tsx`          | Component exported but never imported                                                | Delete                                   |
| `core/src/session/types.ts:61-81`                | `VALID_TRANSITIONS` map marked "for backward compatibility"                          | Delete — XState machine is authoritative |
| `core/src/session/machine.ts:126-148`            | `deriveValidTransitions()` only used in tests                                        | Move to test file                        |
| `core/src/session/session-controller.ts:179-182` | `isCurrentSession()` never called                                                    | Delete                                   |
| `package.json:17-18, 21`                         | Scripts reference `sharego-desktop` and `sharego-mobile` workspaces that don't exist | Fix to `sharego-app` or delete           |

---

## 5. i18n violations (hardcoded strings)

Per project rules, ALL user-facing text must come from `core/src/i18n/en.ts`.

| File                                           | Line(s) | Hardcoded text                   |
| ---------------------------------------------- | ------- | -------------------------------- |
| `apps/app/src/components/ErrorBoundary.tsx`    | 33-35   | Error boundary fallback messages |
| `apps/app/src/App.tsx`                         | 50-51   | Error messages                   |
| `apps/app/src/screens/ActiveSessionScreen.tsx` | ~246    | Session title format             |

---

## 6. Security concerns

### 6a. Overly permissive Electron permissions

**File:** `apps/app/electron/main.ts` lines 48-65
**Issue:** All media permissions are auto-granted without user interaction:

```typescript
session.setPermissionRequestHandler((_, permission, callback) => {
  callback(mediaPermissions.includes(permission)); // auto-grants camera
});
session.setDevicePermissionHandler(() => true); // grants everything
```

**Proper fix:** Only grant camera permission, and only when the user is on the Send screen (scanning QR). Deny all others.

### 6b. No input validation on IPC handlers

**File:** `apps/app/electron/main.ts` lines 83-120
**Issue:** `ws:start`, `ws:send`, `clipboard:copy` accept arbitrary data from the renderer with no validation.
**Proper fix:** Validate port is 1-65535, data is valid base64, text is a string and under max length.

### 6c. `any` types throughout mdns-adapter

**File:** `apps/app/electron/mdns-adapter.ts`
**Issue:** `Bonjour`, `bonjourInstance`, `service`, `browser` all typed as `any`.
**Proper fix:** Create proper TypeScript interfaces for the bonjour-service API, or use `@types/bonjour-service` if available.

### 6d. Sequence number overflow check too permissive

**File:** `core/src/session/session.ts:643-648`
**Issue:** Checks against `Number.MAX_SAFE_INTEGER` (2^53) but protocol uses 32-bit sequence numbers.
**Proper fix:** Check against `0xFFFFFFFF` (2^32 - 1).

### 6e. `constantTimeEqual` in wrong module

**File:** `core/src/session/session.ts:716-724`
**Issue:** Crypto utility defined in session module, not in crypto module.
**Proper fix:** Move to `core/src/crypto/crypto.ts` alongside other crypto primitives.

---

## 7. Build system issues

### 7a. Broken root scripts

**File:** `package.json` lines 17-18, 21

```json
"dev:desktop": "turbo run dev --filter=sharego-desktop",
"dev:mobile": "npm run start --workspace=sharego-mobile",
"dev:android": "npm run android --workspace=sharego-mobile"
```

These reference old workspace names (`sharego-desktop`, `sharego-mobile`) that no longer exist. The actual workspace is `sharego-app`.

### 7b. Missing iOS build in CI

**File:** `.github/workflows/release.yml`
**Issue:** Builds desktop (mac/win/linux) and Android, but not iOS. iOS requires Apple Developer membership and provisioning profiles, but the workflow should at least have a placeholder job.

### 7c. Duplicate version constraints

**Files:** Root `package.json` (overrides) + `apps/app/package.json` (direct deps)
**Issue:** `react-native-svg` is pinned in both `overrides` and `dependencies`. If someone updates one and not the other, they diverge.
**Proper fix:** Use overrides only, or deps only — not both.

---

## 8. What I would do differently from scratch

1. **pnpm over npm** — Deterministic hoisting, no symlink hacks, faster installs, strict mode prevents phantom deps.

2. **Separate Electron package.json** — Electron main process gets its own `package.json` with only `ws` and `bonjour-service`. Zero mobile deps bundled.

3. **Structured logging from day one** — Every module uses a logger interface. No `console.log`, no `catch {}`.

4. **Adapter pattern for everything** — Clipboard, network, camera, storage — all behind interfaces with platform-specific implementations resolved at import time (using package.json `exports` conditions or Vite/Metro aliases).

5. **TypeScript strict mode** — No `any`, no `@ts-expect-error`, no `eslint-disable`. Use proper type declarations for platform differences.

6. **Event queue for IPC** — Instead of subscribing to individual IPC events, use a single multiplexed channel with an event queue that buffers until handlers are ready. Eliminates race conditions.

7. **Proper teardown lifecycle** — Every resource (WebSocket, camera, mDNS browser, timer) implements a `Disposable` interface with deterministic cleanup ordering. No "best effort" cleanup.

8. **Integration tests** — Spin up two Electron instances or two WS clients in a test, verify the full session lifecycle (connect → handshake → approve → exchange → close). Currently there are no integration tests.

9. **Size budget in CI** — Fail the build if the asar exceeds a threshold (e.g., 20MB). Prevents accidental bloat.

10. **Single-channel IPC** — Instead of separate `ws:start`, `ws:send`, `ws:connection`, `ws:message`, `ws:close` IPC channels, use a single `ws` channel with a discriminated union message type. Easier to reason about ordering and add new operations.
