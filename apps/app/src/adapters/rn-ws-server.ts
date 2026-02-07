import TcpSocket from "react-native-tcp-socket";
import { Buffer } from "buffer";
import { NetworkInfo } from "react-native-network-info";
import sha1 from "js-sha1";
import type {
  WebSocketServerAdapter,
  WebSocketClientAdapter,
  ConnectionHandler,
} from "../lib/core";

const WS_MAGIC = "258EAFA5-E914-47DA-95CA-5AB9ADF5B30E";

// ws opcodes
const OP_TEXT = 0x01;
const OP_BINARY = 0x02;
const OP_CLOSE = 0x08;
const OP_PING = 0x09;
const OP_PONG = 0x0a;

function computeAcceptKey(key: string): string {
  const hash = sha1(key + WS_MAGIC);
  const bytes: number[] = [];
  for (let i = 0; i < hash.length; i += 2) {
    bytes.push(parseInt(hash.substr(i, 2), 16));
  }
  return Buffer.from(bytes).toString("base64");
}

function createWsFrame(data: Uint8Array, opcode: number = OP_BINARY): Buffer {
  const length = data.length;
  let header: number[];

  if (length < 126) {
    header = [0x80 | opcode, length];
  } else if (length < 65536) {
    header = [0x80 | opcode, 126, (length >> 8) & 0xff, length & 0xff];
  } else {
    header = [
      0x80 | opcode,
      127,
      0,
      0,
      0,
      0,
      (length >> 24) & 0xff,
      (length >> 16) & 0xff,
      (length >> 8) & 0xff,
      length & 0xff,
    ];
  }

  const frame = Buffer.alloc(header.length + length);
  for (let i = 0; i < header.length; i++) {
    frame[i] = header[i];
  }
  frame.set(data, header.length);
  return frame;
}

interface ParsedFrame {
  fin: boolean;
  opcode: number;
  payload: Uint8Array;
  bytesConsumed: number;
}

function parseWsFrame(buf: Buffer): ParsedFrame | null {
  if (buf.length < 2) return null;

  const byte0 = buf[0];
  const byte1 = buf[1];
  const fin = (byte0 & 0x80) !== 0;
  const opcode = byte0 & 0x0f;
  const masked = (byte1 & 0x80) !== 0;
  let payloadLength = byte1 & 0x7f;
  let offset = 2;

  if (payloadLength === 126) {
    if (buf.length < 4) return null;
    payloadLength = (buf[2] << 8) | buf[3];
    offset = 4;
  } else if (payloadLength === 127) {
    if (buf.length < 10) return null;
    payloadLength = 0;
    for (let i = 2; i < 10; i++) {
      payloadLength = payloadLength * 256 + buf[i];
    }
    offset = 10;
  }

  const maskOffset = masked ? 4 : 0;
  const totalLength = offset + maskOffset + payloadLength;
  if (buf.length < totalLength) return null;

  let payload: Uint8Array;
  if (masked) {
    const mask = buf.subarray(offset, offset + 4);
    const data = buf.subarray(offset + 4, totalLength);
    payload = new Uint8Array(payloadLength);
    for (let i = 0; i < payloadLength; i++) {
      payload[i] = data[i] ^ mask[i % 4];
    }
  } else {
    payload = new Uint8Array(buf.subarray(offset, totalLength));
  }

  return { fin, opcode, payload, bytesConsumed: totalLength };
}

/**
 * websocket client adapter wrapping a raw tcp socket with ws framing.
 * created by the server when a client completes the ws handshake.
 */
class RnWsClient implements WebSocketClientAdapter {
  private messageHandler: ((data: Uint8Array) => void) | null = null;
  private closeHandler: (() => void) | null = null;
  private socket: ReturnType<typeof TcpSocket.createConnection>;
  private buffer: Buffer = Buffer.alloc(0);
  private fragmentBuffer: Uint8Array[] = [];
  private fragmentOpcode: number = 0;

  constructor(socket: ReturnType<typeof TcpSocket.createConnection>) {
    this.socket = socket;

    socket.on("data", (data: Buffer | string) => {
      const chunk = typeof data === "string" ? Buffer.from(data) : data;
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.processFrames();
    });

    socket.on("close", () => {
      if (this.closeHandler) this.closeHandler();
    });

    socket.on("error", () => {
      if (this.closeHandler) this.closeHandler();
    });
  }

  private processFrames(): void {
    while (this.buffer.length > 0) {
      const frame = parseWsFrame(this.buffer);
      if (!frame) break;

      this.buffer = this.buffer.subarray(frame.bytesConsumed);

      // handle control frames immediately (they can appear between fragments)
      if (frame.opcode === OP_CLOSE) {
        try {
          const closeFrame = createWsFrame(frame.payload, OP_CLOSE);
          this.socket.write(closeFrame);
        } catch {
          // best effort
        }
        this.socket.destroy();
        break;
      }
      if (frame.opcode === OP_PING) {
        const pong = createWsFrame(frame.payload, OP_PONG);
        this.socket.write(pong);
        continue;
      }
      if (frame.opcode === OP_PONG) {
        continue;
      }

      // handle data frames with fragmentation support
      if (frame.opcode !== 0) {
        // first frame of a message (or single-frame message)
        this.fragmentOpcode = frame.opcode;
        this.fragmentBuffer = [frame.payload];
      } else {
        // continuation frame
        this.fragmentBuffer.push(frame.payload);
      }

      if (frame.fin) {
        // message is complete — reassemble fragments
        const totalLen = this.fragmentBuffer.reduce((sum, f) => sum + f.length, 0);
        const assembled = new Uint8Array(totalLen);
        let offset = 0;
        for (const frag of this.fragmentBuffer) {
          assembled.set(frag, offset);
          offset += frag.length;
        }
        this.fragmentBuffer = [];

        if (
          (this.fragmentOpcode === OP_BINARY || this.fragmentOpcode === OP_TEXT) &&
          this.messageHandler
        ) {
          this.messageHandler(assembled);
        }
      }
    }
  }

  async connect(_url: string): Promise<void> {
    // not used for server-side client
  }

  send(data: Uint8Array): void {
    const frame = createWsFrame(data, OP_BINARY);
    this.socket.write(frame);
  }

  onMessage(handler: (data: Uint8Array) => void): void {
    this.messageHandler = handler;
  }

  onClose(handler: () => void): void {
    this.closeHandler = handler;
  }

  close(): void {
    try {
      const closeFrame = createWsFrame(new Uint8Array(0), OP_CLOSE);
      this.socket.write(closeFrame);
    } catch {
      // best effort
    }
    this.socket.destroy();
  }
}

/**
 * react native websocket server adapter.
 * builds a minimal ws server on top of react-native-tcp-socket.
 */
export class RnWsServerAdapter implements WebSocketServerAdapter {
  private server: ReturnType<typeof TcpSocket.createServer> | null = null;
  private connectionHandler: ConnectionHandler | null = null;
  private pendingClient: WebSocketClientAdapter | null = null;
  private hasPeer = false;

  async start(port: number): Promise<string> {
    return new Promise((resolve, reject) => {
      this.server = TcpSocket.createServer((socket) => {
        if (this.hasPeer) {
          socket.destroy();
          return;
        }

        let handshakeDone = false;
        let dataBuffer = Buffer.alloc(0);

        const onData = (data: Buffer | string) => {
          if (handshakeDone) return;

          const chunk = typeof data === "string" ? Buffer.from(data) : data;
          dataBuffer = Buffer.concat([dataBuffer, chunk]);
          const request = dataBuffer.toString("utf-8");

          // wait for full http request
          if (!request.includes("\r\n\r\n")) return;

          const keyMatch = request.match(/Sec-WebSocket-Key:\s*(.+)\r\n/i);
          if (!keyMatch) {
            socket.destroy();
            return;
          }

          const acceptKey = computeAcceptKey(keyMatch[1].trim());

          const response = [
            "HTTP/1.1 101 Switching Protocols",
            "Upgrade: websocket",
            "Connection: Upgrade",
            `Sec-WebSocket-Accept: ${acceptKey}`,
            "",
            "",
          ].join("\r\n");

          socket.write(response);
          handshakeDone = true;
          this.hasPeer = true;

          socket.removeListener("data", onData);

          const client = new RnWsClient(socket);
          if (this.connectionHandler) {
            this.connectionHandler(client);
          } else {
            // queue the client if handler isn't registered yet
            this.pendingClient = client;
          }
        };

        socket.on("data", onData);
      });

      // register error handler before listen so early failures are caught
      this.server.on("error", (err: Error) => {
        reject(err.message);
      });

      this.server.listen({ port, host: "0.0.0.0" }, async () => {
        const address = this.server!.address();
        const boundPort =
          address && typeof address === "object" ? address.port : port;

        // detect actual LAN IP since server.address() returns 0.0.0.0
        let host = "0.0.0.0";
        try {
          const lanIp = await NetworkInfo.getIPV4Address();
          if (lanIp) host = lanIp;
        } catch {
          // fallback to 0.0.0.0 if detection fails
        }

        resolve(`${host}:${boundPort}`);
      });
    });
  }

  onConnection(handler: ConnectionHandler): void {
    this.connectionHandler = handler;
    // flush any client that connected before the handler was registered
    if (this.pendingClient) {
      handler(this.pendingClient);
      this.pendingClient = null;
    }
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    this.hasPeer = false;
    this.connectionHandler = null;
    this.pendingClient = null;
  }
}
