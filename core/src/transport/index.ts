export type {
  ILocalTransport,
  TransportState,
  TransportStateCallback,
  MessageCallback,
} from "./types.js";

export {
  WebSocketTransport,
  MAX_MESSAGE_SIZE,
  type WebSocketServerAdapter,
  type WebSocketClientAdapter,
  type ConnectionHandler,
} from "./websocket-transport.js";
