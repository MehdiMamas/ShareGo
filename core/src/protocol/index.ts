export {
  PROTOCOL_VERSION,
  MessageType,
  type BaseMessage,
  type HelloMessage,
  type ChallengeMessage,
  type AuthMessage,
  type AcceptMessage,
  type RejectMessage,
  type DataMessage,
  type AckMessage,
  type CloseMessage,
  type ProtocolMessage,
  type QrPayload,
} from "./types.js";

export {
  serializeMessage,
  deserializeMessage,
  encodeQrPayload,
  decodeQrPayload,
  createBaseFields,
} from "./serialization.js";

export {
  serializeBinaryData,
  deserializeBinaryData,
  isBinaryDataFrame,
  BINARY_DATA_TYPE,
  BINARY_HEADER_SIZE,
  type BinaryDataMessage,
} from "./binary.js";
