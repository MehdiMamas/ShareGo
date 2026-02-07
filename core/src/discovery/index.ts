export type { DiscoveryAdapter, DiscoveredService } from "./types.js";
export { MDNS_SERVICE_TYPE, MDNS_TXT_KEYS } from "./types.js";

export {
  discoverReceiver,
  advertiseReceiver,
  stopAdvertising,
  type DiscoveryOptions,
  type DiscoveryResult,
} from "./discovery.js";
