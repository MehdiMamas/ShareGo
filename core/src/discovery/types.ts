import type { NetworkAddress, SessionId, Base64PublicKey } from "../types/index.js";

/** service discovered on the local network */
export interface DiscoveredService {
  /** service name (e.g. "ShareGo-ABC123") */
  name: string;
  /** network address in ip:port format */
  address: NetworkAddress;
  /** session id from the TXT record */
  sessionId: SessionId;
  /** public key fingerprint from the TXT record */
  publicKey?: Base64PublicKey;
}

/**
 * platform-injectable discovery adapter.
 * each platform (electron, react native) provides its own implementation
 * using the native mDNS/Bonjour/NSD APIs.
 */
export interface DiscoveryAdapter {
  /**
   * advertise this device as a ShareGo receiver.
   * @param serviceName - service type (e.g. "_sharego._tcp")
   * @param port - port the receiver is listening on
   * @param meta - TXT record metadata (session id, public key, etc.)
   */
  advertise(serviceName: string, port: number, meta: Record<string, string>): Promise<void>;

  /**
   * browse for ShareGo receivers on the local network.
   * yields discovered services as they are found.
   * @param serviceName - service type to browse for
   */
  browse(serviceName: string): AsyncIterable<DiscoveredService>;

  /** stop advertising this device */
  stopAdvertising(): void;

  /** stop browsing for services */
  stopBrowsing(): void;
}

/** the mDNS service type used by ShareGo */
export const MDNS_SERVICE_TYPE = "_sharego._tcp";

/** TXT record keys for mDNS metadata */
export const MDNS_TXT_KEYS = {
  /** session id */
  sid: "sid",
  /** public key (base64) */
  pk: "pk",
  /** protocol version */
  v: "v",
} as const;
