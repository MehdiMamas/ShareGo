import { createMachine } from "xstate";
import { SessionState, SessionRole } from "./types.js";

/**
 * session events — each maps to an action that causes a state transition.
 */
export type SessionMachineEvent =
  | { type: "START_RECEIVER" }
  | { type: "START_SENDER" }
  | { type: "SENDER_CONNECTED" }
  | { type: "HANDSHAKE_COMPLETE" }
  | { type: "SENDER_AUTHED" }
  | { type: "APPROVED" }
  | { type: "REJECTED" }
  | { type: "END_SESSION" };

/**
 * context carried through the machine.
 * the heavy lifting (crypto, transport) stays in Session —
 * the machine only governs state transitions.
 */
export interface SessionMachineContext {
  role: SessionRole;
}

/**
 * xstate machine definition for the session state lifecycle.
 *
 * this replaces the manual VALID_TRANSITIONS map with a formal state chart.
 * the machine is used inside Session for transition validation.
 *
 * state chart:
 *
 *   Created ──startReceiver──> WaitingForSender ──senderConnected──> Handshaking
 *   Created ──startSender───> Handshaking
 *   Handshaking ──handshakeComplete──> PendingApproval (receiver)
 *   Handshaking ──senderAuthed──────> Active (sender)
 *   Handshaking ──rejected──────────> Rejected
 *   PendingApproval ──approved──> Active
 *   PendingApproval ──rejected──> Rejected
 *   Active ──endSession──> Closed
 *   Rejected ──endSession──> Closed
 *   any ──endSession──> Closed
 */
export const sessionMachine = createMachine({
  id: "session",
  initial: SessionState.Created,
  types: {} as {
    context: SessionMachineContext;
    events: SessionMachineEvent;
  },
  context: {
    role: SessionRole.Receiver,
  },
  states: {
    [SessionState.Created]: {
      on: {
        START_RECEIVER: { target: SessionState.WaitingForSender },
        START_SENDER: { target: SessionState.Handshaking },
        END_SESSION: { target: SessionState.Closed },
      },
    },
    [SessionState.WaitingForSender]: {
      on: {
        SENDER_CONNECTED: { target: SessionState.Handshaking },
        END_SESSION: { target: SessionState.Closed },
      },
    },
    [SessionState.Handshaking]: {
      on: {
        HANDSHAKE_COMPLETE: { target: SessionState.PendingApproval },
        SENDER_AUTHED: { target: SessionState.Active },
        REJECTED: { target: SessionState.Rejected },
        END_SESSION: { target: SessionState.Closed },
      },
    },
    [SessionState.PendingApproval]: {
      on: {
        APPROVED: { target: SessionState.Active },
        REJECTED: { target: SessionState.Rejected },
        END_SESSION: { target: SessionState.Closed },
      },
    },
    [SessionState.Active]: {
      on: {
        END_SESSION: { target: SessionState.Closed },
      },
    },
    [SessionState.Rejected]: {
      on: {
        END_SESSION: { target: SessionState.Closed },
      },
    },
    [SessionState.Closed]: {
      type: "final",
    },
  },
});

/**
 * maps a (currentState, targetState) pair to the xstate event needed
 * to trigger that transition. used by Session.transition() to bridge
 * the existing imperative API with the xstate machine.
 */
export const STATE_TO_EVENT: Record<string, SessionMachineEvent["type"]> = {
  [`${SessionState.Created}->${SessionState.WaitingForSender}`]: "START_RECEIVER",
  [`${SessionState.Created}->${SessionState.Handshaking}`]: "START_SENDER",
  [`${SessionState.Created}->${SessionState.Closed}`]: "END_SESSION",
  [`${SessionState.WaitingForSender}->${SessionState.Handshaking}`]: "SENDER_CONNECTED",
  [`${SessionState.WaitingForSender}->${SessionState.Closed}`]: "END_SESSION",
  [`${SessionState.Handshaking}->${SessionState.PendingApproval}`]: "HANDSHAKE_COMPLETE",
  [`${SessionState.Handshaking}->${SessionState.Active}`]: "SENDER_AUTHED",
  [`${SessionState.Handshaking}->${SessionState.Rejected}`]: "REJECTED",
  [`${SessionState.Handshaking}->${SessionState.Closed}`]: "END_SESSION",
  [`${SessionState.PendingApproval}->${SessionState.Active}`]: "APPROVED",
  [`${SessionState.PendingApproval}->${SessionState.Rejected}`]: "REJECTED",
  [`${SessionState.PendingApproval}->${SessionState.Closed}`]: "END_SESSION",
  [`${SessionState.Active}->${SessionState.Closed}`]: "END_SESSION",
  [`${SessionState.Rejected}->${SessionState.Closed}`]: "END_SESSION",
};
