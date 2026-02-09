/**
 * transport state lifecycle:
 * idle -> listening (receiver) or connected (sender)
 * listening -> connected (when sender joins)
 * connected -> disconnected (on error or drop)
 * any -> closed (explicit close)
 */
export type TransportState = "idle" | "listening" | "connected" | "disconnected" | "closed";

export type TransportStateCallback = (state: TransportState) => void;
export type MessageCallback = (data: Uint8Array) => void;

/**
 * platform-agnostic local transport interface.
 * v1: WebSocket on LAN.
 * v2: WebRTC DataChannel (same interface, different impl).
 */
export interface ILocalTransport {
  /** receiver: start listening on a port */
  listen(port: number): Promise<void>;

  /** sender: connect to a receiver at addr (e.g. "192.168.1.10:4040") */
  connect(addr: string): Promise<void>;

  /** send encrypted bytes over the transport */
  send(data: Uint8Array): void;

  /** register a callback for incoming messages */
  onMessage(cb: MessageCallback): void;

  /** unregister a message callback */
  offMessage(cb: MessageCallback): void;

  /** register a callback for transport state changes */
  onStateChange(cb: TransportStateCallback): void;

  /** unregister a state change callback */
  offStateChange(cb: TransportStateCallback): void;

  /** close the transport and release resources */
  close(): void;

  /** get current transport state */
  getState(): TransportState;

  /** get the local address this transport is bound to (ip:port) */
  getLocalAddress(): string | null;
}
