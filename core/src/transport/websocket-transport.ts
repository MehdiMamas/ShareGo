import type {
  ILocalTransport,
  TransportState,
  TransportStateCallback,
  MessageCallback,
} from "./types.js";
import { MAX_MESSAGE_SIZE } from "../config.js";

export { MAX_MESSAGE_SIZE };

/** validate that an address is a valid ipv4:port string (rejects leading zeros) */
function isValidAddress(addr: string): boolean {
  const match = addr.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3}):(\d{1,5})$/);
  if (!match) return false;
  const octets = [match[1], match[2], match[3], match[4]];
  if (!octets.every((o) => {
    if (o.length > 1 && o.startsWith("0")) return false; // reject leading zeros
    const n = parseInt(o, 10);
    return n >= 0 && n <= 255;
  })) {
    return false;
  }
  const portStr = match[5];
  if (portStr.length > 1 && portStr.startsWith("0")) return false;
  const port = parseInt(portStr, 10);
  return port >= 1 && port <= 65535;
}

/**
 * v1 transport: local WebSocket.
 *
 * receiver calls listen() — starts a ws server on LAN.
 * sender calls connect() — connects to receiver's ip:port.
 *
 * platform-specific WebSocket server/client implementations are injected
 * via the constructor so this module stays platform-agnostic. electron and
 * react native each provide their own ws bindings.
 */

export interface WebSocketServerAdapter {
  /** start listening on the given port, resolve with the bound address */
  start(port: number): Promise<string>;
  /** register handler for new client connections */
  onConnection(handler: ConnectionHandler): void;
  /** stop the server */
  stop(): Promise<void>;
}

export interface WebSocketClientAdapter {
  /** connect to the given address (e.g. "ws://192.168.1.10:4040") */
  connect(url: string): Promise<void>;
  /** send binary data */
  send(data: Uint8Array): void;
  /** register handler for incoming messages */
  onMessage(handler: (data: Uint8Array) => void): void;
  /** register handler for close */
  onClose(handler: () => void): void;
  /** close the connection */
  close(): void;
}

export type ConnectionHandler = (client: WebSocketClientAdapter) => void;

export class WebSocketTransport implements ILocalTransport {
  private state: TransportState = "idle";
  private stateCallbacks: TransportStateCallback[] = [];
  private messageCallbacks: MessageCallback[] = [];
  private localAddress: string | null = null;
  private peer: WebSocketClientAdapter | null = null;
  private server: WebSocketServerAdapter | null = null;

  constructor(
    private readonly serverFactory?: () => WebSocketServerAdapter,
    private readonly clientFactory?: () => WebSocketClientAdapter,
  ) {}

  async listen(port: number): Promise<void> {
    if (!this.serverFactory) {
      throw new Error("no server factory provided — cannot listen");
    }
    if (this.state !== "idle") {
      throw new Error("transport already started");
    }

    const server = this.serverFactory();
    this.server = server;

    try {
      this.localAddress = await server.start(port);
    } catch (err) {
      this.server = null;
      throw err;
    }

    // transport may have been closed during the async start (e.g. react strict mode)
    if (!this.server) return;

    this.setState("listening");

    this.server.onConnection((client) => {
      // only one peer allowed per session
      if (this.peer) {
        client.close();
        return;
      }

      this.peer = client;
      this.setState("connected");

      // track whether a real protocol message was received from this client.
      // discovery probes connect and immediately disconnect without sending
      // any data — we must not treat those as real peer disconnections.
      let messageReceived = false;

      client.onMessage((data) => {
        messageReceived = true;
        if (data.length > MAX_MESSAGE_SIZE) return; // drop oversized messages
        // snapshot callbacks to prevent mutation during iteration
        const cbs = [...this.messageCallbacks];
        for (const cb of cbs) {
          cb(data);
        }
      });

      client.onClose(() => {
        this.peer = null;
        if (this.state !== "closed") {
          // if no protocol messages were exchanged (e.g. discovery probe),
          // resume listening instead of reporting a disconnection
          this.setState(messageReceived ? "disconnected" : "listening");
        }
      });
    });
  }

  async connect(addr: string): Promise<void> {
    if (!this.clientFactory) {
      throw new Error("no client factory provided — cannot connect");
    }
    if (this.state !== "idle") {
      throw new Error("transport already started");
    }

    // sanitize address — only allow valid ipv4:port or ws://ipv4:port
    const sanitized = addr.trim();
    const bare = sanitized.replace(/^ws:\/\//, "");
    if (!isValidAddress(bare)) {
      throw new Error("invalid address format");
    }

    const client = this.clientFactory();
    const url = sanitized.startsWith("ws://") ? sanitized : `ws://${sanitized}`;

    try {
      await client.connect(url);
    } catch (err) {
      // don't leave transport in inconsistent state on connection failure
      throw err;
    }

    // transport may have been closed externally during the async connect
    if ((this.state as TransportState) === "closed") {
      client.close();
      return;
    }

    this.peer = client;
    this.setState("connected");

    client.onMessage((data) => {
      if (data.length > MAX_MESSAGE_SIZE) return; // drop oversized messages
      // snapshot callbacks to prevent mutation during iteration
      const cbs = [...this.messageCallbacks];
      for (const cb of cbs) {
        cb(data);
      }
    });

    client.onClose(() => {
      this.peer = null;
      if (this.state !== "closed") {
        this.setState("disconnected");
      }
    });
  }

  send(data: Uint8Array): void {
    if (!this.peer) {
      throw new Error("no peer connected — cannot send");
    }
    if (data.length > MAX_MESSAGE_SIZE) {
      throw new Error(`message too large: ${data.length} bytes exceeds ${MAX_MESSAGE_SIZE} limit`);
    }
    this.peer.send(data);
  }

  onMessage(cb: MessageCallback): void {
    this.messageCallbacks.push(cb);
  }

  offMessage(cb: MessageCallback): void {
    const idx = this.messageCallbacks.indexOf(cb);
    if (idx !== -1) this.messageCallbacks.splice(idx, 1);
  }

  onStateChange(cb: TransportStateCallback): void {
    this.stateCallbacks.push(cb);
  }

  offStateChange(cb: TransportStateCallback): void {
    const idx = this.stateCallbacks.indexOf(cb);
    if (idx !== -1) this.stateCallbacks.splice(idx, 1);
  }

  close(): void {
    this.peer?.close();
    this.peer = null;
    this.server?.stop();
    this.server = null;
    this.setState("closed");
    // clear all callbacks to prevent leaks
    this.messageCallbacks.length = 0;
    this.stateCallbacks.length = 0;
  }

  getState(): TransportState {
    return this.state;
  }

  getLocalAddress(): string | null {
    return this.localAddress;
  }

  private setState(next: TransportState): void {
    if (this.state === next) return;
    this.state = next;
    // snapshot callbacks to prevent mutation during iteration
    const cbs = [...this.stateCallbacks];
    for (const cb of cbs) {
      cb(next);
    }
  }
}
