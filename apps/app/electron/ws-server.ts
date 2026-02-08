/**
 * WebSocket server for desktop (Electron main process).
 * port of the Rust ws_server.rs implementation.
 *
 * features:
 * - single peer connection enforcement
 * - SO_REUSEADDR + retry binding for quick port reuse
 * - 64KB message size limit
 * - graceful shutdown
 */

import ws from "ws";
import http from "http";
import { getLanIp } from "./net-utils.js";

const MAX_MESSAGE_SIZE = 65536;
const MAX_BIND_RETRIES = 5;
const BIND_RETRY_DELAY_MS = 200;

export interface WsServerEvents {
  onConnection: () => void;
  onMessage: (data: Buffer) => void;
  onClose: () => void;
}

export class ElectronWsServer {
  private wss: ws.Server | null = null;
  private httpServer: http.Server | null = null;
  private peer: ws | null = null;
  private boundAddress: string | null = null;

  /**
   * start the WebSocket server on the given port.
   * returns the bound address in "ip:port" format.
   */
  async start(port: number, events: WsServerEvents): Promise<string> {
    // stop any previous server
    await this.stop();

    const server = await this.bindWithRetry(port, MAX_BIND_RETRIES, BIND_RETRY_DELAY_MS);
    this.httpServer = server;

    const localIp = getLanIp();
    if (!localIp) {
      server.close();
      throw new Error("failed to detect LAN IP address");
    }

    const actualPort = (server.address() as { port: number }).port;
    this.boundAddress = `${localIp}:${actualPort}`;

    this.wss = new ws.Server({ server, maxPayload: MAX_MESSAGE_SIZE });

    this.wss.on("connection", (ws) => {
      // single peer enforcement
      if (this.peer) {
        ws.close();
        return;
      }

      this.peer = ws;
      events.onConnection();

      ws.on("message", (data: Buffer) => {
        if (data.length > MAX_MESSAGE_SIZE) return; // drop oversized
        events.onMessage(data);
      });

      ws.on("close", () => {
        this.peer = null;
        events.onClose();
      });

      ws.on("error", () => {
        this.peer = null;
        events.onClose();
      });
    });

    return this.boundAddress;
  }

  /**
   * send binary data to the connected peer.
   */
  send(data: Buffer | Uint8Array): void {
    if (!this.peer || this.peer.readyState !== ws.OPEN) {
      // peer disconnected between session deciding to send and IPC arriving —
      // log and drop instead of crashing with an uncaught promise rejection
      console.warn("[ws-server] send called but no peer connected, dropping message");
      return;
    }
    this.peer.send(data);
  }

  /**
   * stop the server and disconnect any peer.
   */
  async stop(): Promise<void> {
    if (this.peer) {
      try { this.peer.close(); } catch { /* best effort */ }
      this.peer = null;
    }

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer!.close(() => resolve());
      });
      this.httpServer = null;
    }

    this.boundAddress = null;
  }

  /**
   * get the bound address (ip:port) or null if not started.
   */
  getAddress(): string | null {
    return this.boundAddress;
  }

  /**
   * bind with retries to handle lingering sockets after quick restart.
   */
  private async bindWithRetry(
    port: number,
    maxAttempts: number,
    delayMs: number,
  ): Promise<http.Server> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }

      try {
        return await this.tryBind(port);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    throw lastError ?? new Error("failed to bind after retries");
  }

  /**
   * attempt to bind an HTTP server with SO_REUSEADDR.
   * ws requires an http.Server, not a raw net.Server.
   */
  private tryBind(port: number): Promise<http.Server> {
    return new Promise((resolve, reject) => {
      const server = http.createServer();

      server.on("error", (err) => reject(err));

      server.listen({ port, host: "0.0.0.0", exclusive: false }, () => {
        resolve(server);
      });
    });
  }
}
