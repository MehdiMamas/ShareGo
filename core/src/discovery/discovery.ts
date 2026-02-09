/**
 * unified discovery module.
 *
 * supports two modes:
 * 1. mDNS discovery (preferred) — uses platform-injected DiscoveryAdapter
 * 2. subnet scanning (fallback) — scans /24 subnet for WebSocket servers
 * 3. manual code entry — user types the session code + address manually
 *
 * platform adapters inject the DiscoveryAdapter at runtime.
 */

import { log } from "../logger.js";

import type { DiscoveryAdapter } from "./types.js";
import { MDNS_SERVICE_TYPE, MDNS_TXT_KEYS } from "./types.js";
import { DISCOVERY_HOST_TIMEOUT_MS, MDNS_BROWSE_TIMEOUT_MS } from "../config.js";
import type { SessionId, Base64PublicKey, NetworkAddress } from "../types/index.js";
import { asNetworkAddress } from "../types/index.js";
import { PROTOCOL_VERSION } from "../protocol/types.js";

export interface DiscoveryOptions {
  /** session code to find */
  sessionCode: SessionId;
  /** port to scan (for subnet fallback) */
  port: number;
  /** resolve the local IPv4 address (for subnet fallback) */
  getLocalIp: () => Promise<string | null>;
  /** optional mDNS discovery adapter (preferred over subnet scanning) */
  discoveryAdapter?: DiscoveryAdapter;
  /** optional abort signal to cancel discovery */
  signal?: AbortSignal;
  /** per-host timeout in ms (for subnet fallback) */
  timeout?: number;
}

export interface DiscoveryResult {
  address: NetworkAddress;
  sessionId: SessionId;
  publicKey?: Base64PublicKey;
}

/**
 * discover a receiver on the local network.
 * tries mDNS first (if adapter is provided), then falls back to subnet scanning.
 */
export async function discoverReceiver(opts: DiscoveryOptions): Promise<DiscoveryResult | null> {
  const { discoveryAdapter, signal } = opts;

  // try mDNS first if an adapter is available
  if (discoveryAdapter) {
    const mdnsResult = await discoverViaMdns(discoveryAdapter, opts.sessionCode, signal);
    if (mdnsResult) return mdnsResult;
  }

  // fall back to subnet scanning
  const subnetResult = await discoverViaSubnet(opts);
  if (subnetResult) {
    return {
      address: asNetworkAddress(subnetResult),
      sessionId: opts.sessionCode,
    };
  }

  return null;
}

/**
 * discover a receiver via mDNS/Bonjour.
 * browses for _sharego._tcp services and matches by session id.
 */
async function discoverViaMdns(
  adapter: DiscoveryAdapter,
  sessionCode: SessionId,
  signal?: AbortSignal,
): Promise<DiscoveryResult | null> {
  if (signal?.aborted) return null;

  const results = adapter.browse(MDNS_SERVICE_TYPE);

  // eslint-disable-next-line no-async-promise-executor -- uses for-await on async iterator
  return new Promise<DiscoveryResult | null>(async (resolve) => {
    const timer = setTimeout(() => {
      adapter.stopBrowsing();
      resolve(null);
    }, MDNS_BROWSE_TIMEOUT_MS);

    const abortHandler = () => {
      clearTimeout(timer);
      adapter.stopBrowsing();
      resolve(null);
    };

    if (signal) {
      signal.addEventListener("abort", abortHandler, { once: true });
    }

    try {
      for await (const service of results) {
        if (service.sessionId === sessionCode) {
          adapter.stopBrowsing();
          resolve({
            address: service.address,
            sessionId: service.sessionId,
            publicKey: service.publicKey,
          });
          return;
        }
      }
    } catch {
      // browsing ended or errored
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abortHandler);
    }

    resolve(null);
  });
}

/**
 * advertise this device as a ShareGo receiver via mDNS.
 */
export async function advertiseReceiver(
  adapter: DiscoveryAdapter,
  port: number,
  sessionId: SessionId,
  publicKey: Base64PublicKey,
): Promise<void> {
  await adapter.advertise(MDNS_SERVICE_TYPE, port, {
    [MDNS_TXT_KEYS.sid]: sessionId,
    [MDNS_TXT_KEYS.pk]: publicKey,
    [MDNS_TXT_KEYS.v]: String(PROTOCOL_VERSION),
  });
}

/**
 * stop advertising this device.
 */
export function stopAdvertising(adapter: DiscoveryAdapter): void {
  adapter.stopAdvertising();
}

// -- subnet scanning fallback (legacy) --

async function discoverViaSubnet(opts: DiscoveryOptions): Promise<string | null> {
  const { port, getLocalIp, signal, timeout = DISCOVERY_HOST_TIMEOUT_MS } = opts;

  const localIp = await getLocalIp();
  if (!localIp) return null;
  const parts = localIp.split(".");
  if (parts.length !== 4) return null;
  const subnet = `${parts[0]}.${parts[1]}.${parts[2]}`;

  const sockets: WebSocket[] = [];
  const timeouts: ReturnType<typeof setTimeout>[] = [];
  let found = false;

  return new Promise<string | null>((resolveOuter) => {
    let pending = 254;

    function finish(result: string | null) {
      if (found) return;
      found = true;
      for (const t of timeouts) clearTimeout(t);
      const snapshot = [...sockets];
      for (const ws of snapshot) {
        try {
          ws.close();
        } catch (e) {
          log.warn("[discovery] socket close failed:", e);
        }
      }
      resolveOuter(result);
    }

    if (signal) {
      if (signal.aborted) {
        resolveOuter(null);
        return;
      }
      signal.addEventListener("abort", () => finish(null), { once: true });
    }

    for (let i = 1; i <= 254; i++) {
      const ip = `${subnet}.${i}`;
      const url = `ws://${ip}:${port}`;
      const ws = new WebSocket(url);
      sockets.push(ws);

      if (found) {
        try {
          ws.close();
        } catch (e) {
          log.warn("[discovery] socket close failed:", e);
        }
        continue;
      }

      const timer = setTimeout(() => {
        try {
          ws.close();
        } catch (e) {
          log.warn("[discovery] timeout close failed:", e);
        }
        if (--pending === 0 && !found) finish(null);
      }, timeout);
      timeouts.push(timer);

      ws.onopen = () => {
        clearTimeout(timer);
        ws.close();
        finish(`${ip}:${port}`);
      };
      ws.onerror = () => {
        clearTimeout(timer);
        if (--pending === 0 && !found) finish(null);
      };
    }
  });
}
