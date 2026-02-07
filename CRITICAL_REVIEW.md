# ShareGo Mobile React Native App - Critical Review

## Summary
This review identifies **27 critical issues** across React Native-specific bugs, state management, error handling, cleanup leaks, type safety, platform parity violations, and Rust backend concerns.

---

## 1. REACT NATIVE SPECIFIC BUGS

### 1.1 Missing cleanup for discovery WebSocket connections
**File:** `apps/mobile-rn/src/screens/SendScreen.tsx`  
**Lines:** 27-71  
**Severity:** HIGH  
**Issue:** The `discoverReceiver` function creates 254 WebSocket connections in parallel. If the component unmounts during discovery, these sockets are not cleaned up, causing memory leaks and potential crashes.

**Fix:** Add a ref to track if component is mounted, and close all sockets in cleanup:
```typescript
const mountedRef = useRef(true);
useEffect(() => () => { mountedRef.current = false; }, []);

// In discoverReceiver, check mountedRef.current before resolving
// Close all sockets in cleanup
```

### 1.2 Timer ref type mismatch
**File:** `apps/mobile-rn/src/screens/ReceiveScreen.tsx`  
**Line:** 24  
**Severity:** MEDIUM  
**Issue:** `timerRef` is typed as `ReturnType<typeof setInterval>` which returns `number` in Node.js but may not match React Native's timer return type. Should use `NodeJS.Timeout | null` or `number | null`.

**Fix:** Change to `useRef<number | null>(undefined)` or use `ReturnType<typeof setTimeout>` consistently.

### 1.3 Navigation race condition
**File:** `apps/mobile-rn/src/screens/SendScreen.tsx`  
**Lines:** 83-87  
**Severity:** MEDIUM  
**Issue:** Navigation to ActiveSession happens in useEffect without checking if component is still mounted. If user navigates away quickly, this could cause navigation errors.

**Fix:** Add mounted check or use navigation listener cleanup.

### 1.4 Missing cleanup for regenerate timeout
**File:** `apps/mobile-rn/src/screens/ReceiveScreen.tsx`  
**Lines:** 78-82  
**Severity:** MEDIUM  
**Issue:** `handleRegenerate` uses `setTimeout` but doesn't clean it up if component unmounts before the timeout fires.

**Fix:** Store timeout in ref and clear in cleanup.

---

## 2. STATE MANAGEMENT ISSUES

### 2.1 Session context shared across screens without cleanup
**File:** `apps/mobile-rn/src/App.tsx`  
**Lines:** 33-34  
**Severity:** HIGH  
**Issue:** `session` and `transport` hooks are created at App level and shared across all screens. When screens unmount/remount, the session state persists, which can cause stale state issues.

**Fix:** Consider moving session/transport to screen level, or add proper cleanup when navigating between screens.

### 2.2 Connecting state not reset on error
**File:** `apps/mobile-rn/src/screens/SendScreen.tsx`  
**Lines:** 89-110  
**Severity:** MEDIUM  
**Issue:** If `startSender` throws an error, `setConnecting(false)` is called, but if the error comes from the session itself (not the try/catch), `connecting` state may remain true.

**Fix:** Add error listener to reset connecting state, or ensure all error paths reset state.

### 2.3 Local state not reset when session ends externally
**File:** `apps/mobile-rn/src/screens/SendScreen.tsx`  
**Lines:** 73-80  
**Severity:** MEDIUM  
**Issue:** If session ends externally (e.g., from another screen or error), local state (`connecting`, `discovering`, `inputError`) is not reset.

**Fix:** Add useEffect to watch `session.state` and reset local state when session closes.

---

## 3. ERROR HANDLING GAPS

### 3.1 NetworkInfo.getIPV4Address() can throw
**File:** `apps/mobile-rn/src/screens/SendScreen.tsx`  
**Line:** 28  
**Severity:** MEDIUM  
**Issue:** `NetworkInfo.getIPV4Address()` can throw or return null, but error handling is incomplete. If it throws, the promise rejects without proper error message.

**Fix:** Wrap in try/catch and provide user-friendly error message.

### 3.2 QR scanner error not displayed
**File:** `apps/mobile-rn/src/screens/SendScreen.tsx`  
**Lines:** 112-124  
**Severity:** LOW  
**Issue:** If `decodeQrPayload` or `connectToReceiver` throws, error is set but user may not see it if they switch tabs quickly.

**Fix:** Ensure error persists or is shown in a more prominent location.

### 3.3 Transport creation errors not handled
**File:** `apps/mobile-rn/src/screens/SendScreen.tsx`  
**Line:** 94  
**Severity:** MEDIUM  
**Issue:** `transport.createSenderTransport()` could theoretically throw, but it's not wrapped in try/catch.

**Fix:** Add error handling for transport creation.

### 3.4 Rust backend: Error messages not user-friendly
**File:** `apps/desktop-tauri/src-tauri/src/ws_server.rs`  
**Lines:** 293-295  
**Severity:** LOW  
**Issue:** Raw error messages from socket operations are passed to frontend without sanitization. Could expose internal details.

**Fix:** Map common errors to user-friendly messages.

---

## 4. UI/UX ISSUES

### 4.1 Missing loading state during session start
**File:** `apps/mobile-rn/src/screens/ReceiveScreen.tsx`  
**Lines:** 106-108  
**Severity:** LOW  
**Issue:** While `started` is false, only text is shown. No loading indicator.

**Fix:** Add ActivityIndicator (matches desktop behavior).

### 4.2 Error text can overflow
**File:** `apps/mobile-rn/src/screens/SendScreen.tsx`  
**Line:** 275-278  
**Severity:** LOW  
**Issue:** Error text doesn't wrap, could overflow on small screens.

**Fix:** Add `flexWrap` or `numberOfLines` prop.

### 4.3 Copy button feedback not accessible
**File:** `apps/mobile-rn/src/screens/ActiveSessionScreen.tsx`  
**Lines:** 54-59  
**Severity:** LOW  
**Issue:** Copy feedback uses visual state only. No haptic feedback or accessibility announcement.

**Fix:** Add haptic feedback and accessibility label updates.

---

## 5. MISSING CLEANUP ON UNMOUNT

### 5.1 Event listeners never removed from Session
**File:** `apps/mobile-rn/src/hooks/useSession.ts`  
**Lines:** 80-108  
**Severity:** HIGH  
**Issue:** `attachListeners` adds event listeners to Session but never removes them. When `cleanup()` is called or component unmounts, listeners remain attached, causing memory leaks and potential calls on unmounted components.

**Fix:** Store listener references and call `session.off()` for each in cleanup:
```typescript
const listenersRef = useRef<Map<SessionEvent, Function>>(new Map());
// Store listeners, then in cleanup:
listenersRef.current.forEach((handler, event) => {
  sessionRef.current?.off(event, handler);
});
```

### 5.2 WebSocketTransport callbacks never removed
**File:** `core/src/transport/websocket-transport.ts`  
**Lines:** 150-156  
**Severity:** HIGH  
**Issue:** `onMessage` and `onStateChange` push callbacks to arrays but never remove them. When transport is reused or recreated, old callbacks accumulate.

**Fix:** Add `offMessage` and `offStateChange` methods, or clear callbacks in `close()`.

### 5.3 QRScanner camera not stopped on unmount
**File:** `apps/mobile-rn/src/components/QRScanner.tsx`  
**Lines:** 87-92  
**Severity:** MEDIUM  
**Issue:** Camera component doesn't explicitly stop camera when component unmounts. React Native Vision Camera should handle this, but explicit cleanup is safer.

**Fix:** Add cleanup effect to ensure camera is stopped.

### 5.4 Discovery WebSocket cleanup incomplete
**File:** `apps/mobile-rn/src/screens/SendScreen.tsx`  
**Lines:** 34-70  
**Severity:** HIGH  
**Issue:** If component unmounts during discovery, the promise continues and sockets may not be closed. The `finish` function closes sockets, but only if called.

**Fix:** Store sockets array in ref, add cleanup effect to close all sockets.

### 5.5 Timer not cleared if countdown effect runs multiple times
**File:** `apps/mobile-rn/src/screens/ReceiveScreen.tsx`  
**Lines:** 55-68  
**Severity:** LOW  
**Issue:** If `started` changes multiple times quickly, multiple intervals could be created. Cleanup clears the ref, but if the ref is overwritten, old interval leaks.

**Fix:** Clear interval before creating new one, or use functional update to ensure latest ref.

---

## 6. EVENT LISTENER LEAKS

### 6.1 Session event listeners leak (duplicate of 5.1)
**File:** `apps/mobile-rn/src/hooks/useSession.ts`  
**Lines:** 80-108  
**Severity:** HIGH  
**Issue:** Same as 5.1 - listeners added but never removed.

### 6.2 Transport state callbacks leak
**File:** `core/src/transport/websocket-transport.ts`  
**Lines:** 154-156  
**Severity:** MEDIUM  
**Issue:** State change callbacks accumulate across transport recreations.

---

## 7. TYPE SAFETY ISSUES

### 7.1 SessionContext can be null but not checked
**File:** `apps/mobile-rn/src/screens/SendScreen.tsx`  
**Line:** 74  
**Severity:** MEDIUM  
**Issue:** `useContext(SessionContext)!` uses non-null assertion, but context could theoretically be null if used outside provider.

**Fix:** Add null check or throw descriptive error.

### 7.2 Timer ref type inconsistency
**File:** `apps/mobile-rn/src/screens/ReceiveScreen.tsx`  
**Line:** 24  
**Severity:** LOW  
**Issue:** Already covered in 1.2.

### 7.3 WebSocket message event type
**File:** `apps/mobile-rn/src/adapters/rn-ws-client.ts`  
**Line:** 32  
**Severity:** LOW  
**Issue:** `WebSocketMessageEvent` may not be defined in React Native types. Should use generic `MessageEvent` or check React Native WebSocket types.

**Fix:** Verify type exists or use `any` with comment.

---

## 8. PLATFORM PARITY VIOLATIONS

### 8.1 Missing navigation to ActiveSession in ReceiveScreen
**File:** `apps/mobile-rn/src/screens/ReceiveScreen.tsx`  
**Severity:** HIGH  
**Issue:** Desktop ReceiveScreen doesn't navigate to ActiveSession (it's handled in App.tsx), but mobile ReceiveScreen also doesn't navigate. However, SendScreen does navigate (line 83-87). This is inconsistent.

**Fix:** Add navigation effect to ReceiveScreen to match SendScreen behavior, OR document why it's different.

### 8.2 Device name mismatch
**File:** `apps/mobile-rn/src/screens/SendScreen.tsx`  
**Line:** 97  
**File:** `apps/mobile-rn/src/screens/ReceiveScreen.tsx`  
**Line:** 34  
**Severity:** LOW  
**Issue:** SendScreen uses "Mobile Sender", ReceiveScreen uses "Mobile". Desktop uses "Desktop Sender" and "Desktop". Should be consistent.

**Fix:** Use "Mobile" for both, or "Mobile Sender"/"Mobile Receiver".

### 8.3 Error message text differences
**File:** `apps/mobile-rn/src/screens/SendScreen.tsx`  
**Line:** 139  
**File:** `apps/desktop-tauri/src/components/SendScreen.tsx`  
**Line:** 126  
**Severity:** LOW  
**Issue:** Mobile: "could not find receiver on your network — make sure both devices are on the same WiFi"  
Desktop: "could not find receiver on your network — make sure both devices are on the same WiFi"  
Actually they match, but verify all error messages are identical.

### 8.4 Missing "tap to regenerate" button styling parity
**File:** `apps/mobile-rn/src/screens/ReceiveScreen.tsx`  
**Lines:** 122-130  
**File:** `apps/desktop-tauri/src/components/ReceiveScreen.tsx`  
**Lines:** 154-166  
**Severity:** LOW  
**Issue:** Button text and styling should match exactly. Verify padding, colors, font sizes match.

---

## 9. RUST BACKEND ISSUES

### 9.1 Potential race condition in server start/stop
**File:** `apps/desktop-tauri/src-tauri/src/ws_server.rs`  
**Lines:** 45-54  
**Severity:** MEDIUM  
**Issue:** `start()` acquires `op_lock`, calls `stop_inner()`, then binds. However, if `stop()` is called concurrently after `start()` acquires lock but before binding, there could be a brief window where server is stopped but listener handle isn't cleaned up.

**Fix:** The lock should prevent this, but verify the logic is correct. Consider adding a state enum to track server state explicitly.

### 9.2 Error handling in WebSocket message processing
**File:** `apps/desktop-tauri/src-tauri/src/ws_server.rs`  
**Lines:** 103-134  
**Severity:** LOW  
**Issue:** Errors in message processing are silently ignored (line 129: `Err(_) => break`). Should log errors for debugging.

**Fix:** Add error logging or emit error event to frontend.

### 9.3 No timeout for WebSocket handshake
**File:** `apps/desktop-tauri/src-tauri/src/ws_server.rs`  
**Lines:** 87-90  
**Severity:** LOW  
**Issue:** If WebSocket handshake hangs, connection stays open indefinitely. Should add timeout.

**Fix:** Add timeout for `accept_async` call.

### 9.4 Socket not closed on handshake failure
**File:** `apps/desktop-tauri/src-tauri/src/ws_server.rs`  
**Line:** 89  
**Severity:** LOW  
**Issue:** If `accept_async` fails, stream is dropped but not explicitly closed. Should ensure socket is closed.

**Fix:** Explicitly close/destroy stream on error.

### 9.5 Missing validation for local IP address
**File:** `apps/desktop-tauri/src-tauri/src/ws_server.rs`  
**Line:** 64  
**Severity:** LOW  
**Issue:** `local_ip_address::local_ip()` could return an invalid IP. Should validate format.

**Fix:** Validate IP format before using.

---

## 10. ADDITIONAL ISSUES

### 10.1 Missing cleanup in useSession when sessionId changes
**File:** `apps/mobile-rn/src/hooks/useSession.ts`  
**Lines:** 110-136  
**Severity:** MEDIUM  
**Issue:** When `startReceiver` is called, it calls `cleanup()` which closes the old session. However, if `startReceiver` is called multiple times rapidly, listeners from the old session may still fire.

**Fix:** Ensure cleanup completes before starting new session, or add a guard.

### 10.2 Transport cleanup in useTransport may race
**File:** `apps/mobile-rn/src/hooks/useTransport.ts`  
**Lines:** 9-14  
**Severity:** LOW  
**Issue:** `cleanupPrevious` is called before creating new transport, but if cleanup is async (it's not), there could be a race.

**Fix:** Current implementation is fine since `close()` is synchronous, but document this assumption.

### 10.3 QRScanner ref not used
**File:** `apps/mobile-rn/src/components/QRScanner.tsx`  
**Lines:** 18-30  
**Severity:** LOW  
**Issue:** Component exposes `reset` via `useImperativeHandle`, but parent (`SendScreen`) doesn't use the ref. If QR scan fails, there's no way to reset.

**Fix:** Either use the ref in SendScreen, or remove `useImperativeHandle` if not needed.

### 10.4 Missing error boundary
**File:** `apps/mobile-rn/src/App.tsx`  
**Severity:** MEDIUM  
**Issue:** No error boundary to catch React errors. If a component crashes, entire app crashes.

**Fix:** Add ErrorBoundary component.

### 10.5 ActiveSessionScreen: FlatList keyExtractor could collide
**File:** `apps/mobile-rn/src/screens/ActiveSessionScreen.tsx`  
**Lines:** 134-138  
**Severity:** LOW  
**Issue:** Key uses `index` as fallback for received items, which could cause React key warnings if items are reordered.

**Fix:** Use only `received.id` without index, or ensure IDs are unique.

---

## PRIORITY SUMMARY

### CRITICAL (Fix Immediately)
1. Event listener leaks in useSession (5.1, 6.1)
2. Discovery WebSocket cleanup (1.1, 5.4)
3. WebSocketTransport callback leaks (5.2, 6.2)

### HIGH (Fix Soon)
4. Session context shared state (2.1)
5. Navigation race condition (1.3)
6. Missing cleanup for regenerate timeout (1.4)

### MEDIUM (Fix When Possible)
7. Connecting state not reset (2.2)
8. Local state not reset on external session end (2.3)
9. NetworkInfo error handling (3.1)
10. Transport creation error handling (3.3)
11. Timer ref type (1.2)
12. SessionContext null check (7.1)
13. Rust server race condition (9.1)

### LOW (Nice to Have)
14. All other issues listed above

---

## RECOMMENDATIONS

1. **Add comprehensive cleanup tests** - Test that all resources are cleaned up on unmount
2. **Add error boundary** - Prevent app crashes from component errors
3. **Add logging** - Add structured logging for debugging production issues
4. **Add integration tests** - Test full flows including cleanup scenarios
5. **Document cleanup requirements** - Add comments explaining why cleanup is needed
6. **Consider using a state management library** - If session state becomes more complex, consider Redux or Zustand
7. **Add TypeScript strict mode** - Enable stricter type checking to catch more issues
8. **Add ESLint rules** - Add rules for cleanup (exhaustive-deps, etc.)
