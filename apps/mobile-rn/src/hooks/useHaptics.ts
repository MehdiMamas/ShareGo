import { useEffect, useRef } from "react";
import { SessionState } from "../lib/core";
import type { UseSessionReturn } from "./useSession";

// graceful import — the native module may not be linked (e.g. pod install
// not run, CI builds, or library not compatible with current RN arch).
// the app must never crash if haptics are unavailable.
let HapticFeedback: typeof import("react-native-haptic-feedback").default | null =
  null;
try {
  HapticFeedback = require("react-native-haptic-feedback").default;
} catch {
  // native module not available — haptics silently disabled
}

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

function trigger(type: string): void {
  try {
    HapticFeedback?.trigger(type as any, hapticOptions);
  } catch {
    // silently ignore runtime errors
  }
}

/**
 * triggers haptic feedback on key session events.
 * - connected: success notification
 * - data received: light impact
 * - session ended from active: warning notification
 *
 * gracefully degrades to no-op if the native module is unavailable.
 */
export function useHaptics(session: UseSessionReturn): void {
  const prevStateRef = useRef(session.state);
  const prevReceivedCountRef = useRef(session.receivedItems.length);

  useEffect(() => {
    const prev = prevStateRef.current;
    prevStateRef.current = session.state;

    if (session.state === SessionState.Active && prev !== SessionState.Active) {
      trigger("notificationSuccess");
    } else if (
      session.state === SessionState.Closed &&
      prev === SessionState.Active
    ) {
      trigger("notificationWarning");
    }
  }, [session.state]);

  useEffect(() => {
    const prevCount = prevReceivedCountRef.current;
    prevReceivedCountRef.current = session.receivedItems.length;

    if (session.receivedItems.length > prevCount) {
      trigger("impactLight");
    }
  }, [session.receivedItems.length]);
}
