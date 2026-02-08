/**
 * shared configuration constants used across all platforms.
 * single source of truth — never duplicate these values in app code.
 */

/** qr/code expiry in seconds — how long a QR code is valid before auto-regeneration */
export const BOOTSTRAP_TTL = 30;

/** session expiry in seconds — how long a session can live after creation */
export const SESSION_TTL = 300;

/** default websocket server port */
export const DEFAULT_PORT = 4040;

/** session code length (6-char alphanumeric) */
export const SESSION_CODE_LENGTH = 6;

/** delay before regenerating a new session after expiry (ms) */
export const REGENERATION_DELAY_MS = 300;

/** copy-to-clipboard feedback duration (ms) */
export const COPY_FEEDBACK_MS = 2000;

/** websocket connection timeout (ms) */
export const WS_CONNECT_TIMEOUT_MS = 10000;

/** per-host discovery timeout when scanning subnet (ms) */
export const DISCOVERY_HOST_TIMEOUT_MS = 1500;

/** countdown tick interval (ms) */
export const COUNTDOWN_INTERVAL_MS = 1000;

/** max websocket message size in bytes (64 KB) */
export const MAX_MESSAGE_SIZE = 65536;

/** max allowed gap between consecutive sequence numbers (prevents gap attacks) */
export const MAX_SEQ_GAP = 100;

/** max length for base64-encoded fields (ciphertext, proof, pk, nonce) */
export const MAX_BASE64_FIELD_LENGTH = 131072;

/** max device name length in characters */
export const MAX_DEVICE_NAME_LENGTH = 256;

/** session code placeholder text shown in input fields */
export const CODE_PLACEHOLDER = "ABC123";

/** mDNS browse timeout in ms */
export const MDNS_BROWSE_TIMEOUT_MS = 5000;

/** default device name for the receiver */
export const DEVICE_NAME_RECEIVER = "ShareGo";

/** default device name for the sender */
export const DEVICE_NAME_SENDER = "ShareGo Sender";
