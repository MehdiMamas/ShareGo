import { useEffect, useRef } from "react";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import { SessionState } from "../lib/core";
import type { UseSessionReturn } from "./useSession";

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

/**
 * triggers haptic feedback on key session events.
 * - connected: success notification
 * - data received: light impact
 * - session ended from active: warning notification
 */
export function useHaptics(session: UseSessionReturn): void {
  const prevStateRef = useRef(session.state);
  const prevReceivedCountRef = useRef(session.receivedItems.length);

  useEffect(() => {
    const prev = prevStateRef.current;
    prevStateRef.current = session.state;

    if (session.state === SessionState.Active && prev !== SessionState.Active) {
      ReactNativeHapticFeedback.trigger("notificationSuccess", hapticOptions);
    } else if (
      session.state === SessionState.Closed &&
      prev === SessionState.Active
    ) {
      ReactNativeHapticFeedback.trigger("notificationWarning", hapticOptions);
    }
  }, [session.state]);

  useEffect(() => {
    const prevCount = prevReceivedCountRef.current;
    prevReceivedCountRef.current = session.receivedItems.length;

    if (session.receivedItems.length > prevCount) {
      ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    }
  }, [session.receivedItems.length]);
}
