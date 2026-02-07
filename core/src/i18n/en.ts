/**
 * english translation resource.
 * single source of truth for all user-facing text.
 * both desktop and mobile must use these translations.
 */
const en = {
  home: {
    title: "ShareGo",
    description:
      "securely share passwords, OTPs, and sensitive text between devices on the same network",
    receive: "show QR code / show code",
    send: "scan QR code / enter code",
  },
  receive: {
    starting: "starting session...",
    waitingQr: "waiting for QR code...",
    handshaking: "handshaking with sender...",
    regenerating: "regenerating...",
    expires: "expires in {{seconds}}s",
    failedStart: "failed to start: {{detail}}",
  },
  send: {
    tabScan: "scan QR",
    tabCode: "enter code",
    hintCode: "enter the 6-character code shown on the receiver",
    errorCodeLength: "enter a 6-character code",
    errorConnectionFailed: "connection failed",
    errorInvalidQr: "invalid QR code",
    errorNotFound:
      "could not find receiver on your network — make sure both devices are on the same WiFi",
    errorDiscovery: "discovery failed",
    errorRejected: "connection was rejected by the receiver",
    searching: "searching for receiver on your network...",
    connecting: "connecting...",
    waitingApproval: "waiting for approval...",
  },
  session: {
    delivered: "delivered",
    sending: "sending...",
    emptyMessages: "no messages yet",
    inputPlaceholder: "enter text to send...",
    sendButton: "send",
    endSession: "end session",
    copy: "copy",
    copied: "copied!",
  },
  approval: {
    title: "pairing request",
    body: "{{deviceName}} wants to connect. allow this device?",
    accept: "accept",
    reject: "reject",
  },
  status: {
    created: "created",
    waitingForSender: "waiting for sender...",
    handshaking: "handshaking...",
    pendingApproval: "pending approval",
    active: "connected",
    rejected: "rejected",
    closed: "closed",
  },
  camera: {
    error: "camera not available — use manual code entry instead",
    hint: "point the camera at the QR code",
    starting: "starting camera...",
  },
  common: {
    back: "back",
    cancel: "cancel",
    rejectionReason: "user rejected",
  },
} as const;

export default en;

export type TranslationResource = typeof en;
