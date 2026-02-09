import type { SequenceNumber } from "../types/index.js";

/**
 * session states — matches the lifecycle in the protocol spec.
 *
 * Created -> WaitingForSender -> Handshaking -> PendingApproval -> Active -> Closed
 *                                                  \-> Rejected -> Closed
 */
export enum SessionState {
  /** session object created, not yet listening */
  Created = "Created",
  /** receiver is listening, QR/code displayed, waiting for sender */
  WaitingForSender = "WaitingForSender",
  /** sender connected, key exchange in progress */
  Handshaking = "Handshaking",
  /** keys exchanged, waiting for receiver to approve or reject */
  PendingApproval = "PendingApproval",
  /** session active, data can flow */
  Active = "Active",
  /** receiver rejected the sender */
  Rejected = "Rejected",
  /** session ended (normal close or error) */
  Closed = "Closed",
}

/** role in the session */
export enum SessionRole {
  Receiver = "Receiver",
  Sender = "Sender",
}

/** event types emitted by the session */
export enum SessionEvent {
  StateChanged = "StateChanged",
  PairingRequest = "PairingRequest",
  DataReceived = "DataReceived",
  DataAcknowledged = "DataAcknowledged",
  Error = "Error",
}

/** pairing request details shown to the receiver for approval */
export interface PairingRequest {
  deviceName: string;
  publicKey: Uint8Array;
}

/** callback signatures for session events */
export type SessionEventMap = {
  [SessionEvent.StateChanged]: (state: SessionState) => void;
  [SessionEvent.PairingRequest]: (request: PairingRequest) => void;
  [SessionEvent.DataReceived]: (plaintext: Uint8Array) => void;
  [SessionEvent.DataAcknowledged]: (seq: SequenceNumber) => void;
  [SessionEvent.Error]: (error: Error) => void;
};
