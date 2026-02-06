import type {
  ILocalTransport,
  TransportState,
  TransportStateCallback,
  MessageCallback,
} from "./types.js";

/**
 * v1 transport: local WebSocket.
 *
 * receiver calls listen() — starts a ws server on LAN.
 * sender calls connect() — connects to receiver's ip:port.
 *
 * platform-specific WebSocket server/client implementations are injected
 * via the constructor so this module stays platform-agnostic. tauri and
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

    this.server = this.serverFactory();
    this.localAddress = await this.server.start(port);
    this.setState("listening");

    this.server.onConnection((client) => {
      // only one peer allowed per session
      if (this.peer) {
        client.close();
        return;
      }

      this.peer = client;
      this.setState("connected");

      client.onMessage((data) => {
        for (const cb of this.messageCallbacks) {
          cb(data);
        }
      });

      client.onClose(() => {
        this.peer = null;
        if (this.state !== "closed") {
          this.setState("disconnected");
        }
      });
    });
  }

  async connect(addr: string): Promise<void> {
    if (!this.clientFactory) {
      throw new Error("no client factory provided — cannot connect");
    }

    const client = this.clientFactory();
    const url = addr.startsWith("ws://") ? addr : `ws://${addr}`;
    await client.connect(url);

    this.peer = client;
    this.setState("connected");

    client.onMessage((data) => {
      for (const cb of this.messageCallbacks) {
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
    this.peer.send(data);
  }

  onMessage(cb: MessageCallback): void {
    this.messageCallbacks.push(cb);
  }

  onStateChange(cb: TransportStateCallback): void {
    this.stateCallbacks.push(cb);
  }

  close(): void {
    this.peer?.close();
    this.peer = null;
    this.server?.stop();
    this.server = null;
    this.setState("closed");
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
    for (const cb of this.stateCallbacks) {
      cb(next);
    }
  }
}
