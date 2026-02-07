/**
 * shared user-facing strings used across all platforms.
 * single source of truth — never duplicate text in app code.
 * both desktop and mobile must display these word-for-word.
 */

// -- home screen --
export const APP_TITLE = "ShareGo";
export const APP_DESCRIPTION =
  "securely share passwords, OTPs, and sensitive text between devices on the same network";
export const BTN_RECEIVE = "show QR code / show code";
export const BTN_SEND = "scan QR code / enter code";

// -- receive screen --
export const STATUS_STARTING = "starting session...";
export const STATUS_WAITING_QR = "waiting for QR code...";
export const STATUS_HANDSHAKING = "handshaking with sender...";
export const STATUS_REGENERATING = "regenerating...";
export const STATUS_EXPIRES = (seconds: number) => `expires in ${seconds}s`;
export const ERROR_FAILED_START = (detail: string) => `failed to start: ${detail}`;

// -- send screen --
export const TAB_SCAN = "scan QR";
export const TAB_CODE = "enter code";
export const HINT_ENTER_CODE = "enter the 6-character code shown on the receiver";
export const ERROR_CODE_LENGTH = "enter a 6-character code";
export const ERROR_CONNECTION_FAILED = "connection failed";
export const ERROR_INVALID_QR = "invalid QR code";
export const ERROR_RECEIVER_NOT_FOUND =
  "could not find receiver on your network — make sure both devices are on the same WiFi";
export const ERROR_DISCOVERY_FAILED = "discovery failed";
export const STATUS_SEARCHING = "searching for receiver on your network...";
export const STATUS_CONNECTING = "connecting...";
export const STATUS_WAITING_APPROVAL = "waiting for approval...";
export const ERROR_REJECTED = "connection was rejected by the receiver";

// -- active session --
export const STATUS_DELIVERED = "delivered";
export const STATUS_SENDING = "sending...";
export const EMPTY_MESSAGES = "no messages yet";
export const INPUT_PLACEHOLDER = "enter text to send...";
export const BTN_SEND_DATA = "send";
export const BTN_END_SESSION = "end session";
export const BTN_COPY = "copy";
export const BTN_COPIED = "copied!";

// -- approval dialog --
export const DIALOG_TITLE = "pairing request";
export const DIALOG_BODY = (deviceName: string) =>
  `${deviceName} wants to connect. allow this device?`;
export const BTN_ACCEPT = "accept";
export const BTN_REJECT = "reject";

// -- common --
export const BTN_BACK = "back";
export const BTN_CANCEL = "cancel";
export const REJECTION_REASON = "user rejected";

// -- status indicator labels --
export const STATUS_LABELS: Record<string, string> = {
  Created: "created",
  WaitingForSender: "waiting for sender...",
  Handshaking: "handshaking...",
  PendingApproval: "pending approval",
  Active: "connected",
  Rejected: "rejected",
  Closed: "closed",
};

// -- qr scanner --
export const CAMERA_ERROR = "camera not available — use manual code entry instead";
export const CAMERA_HINT = "point the camera at the QR code";
export const CAMERA_STARTING = "starting camera...";
