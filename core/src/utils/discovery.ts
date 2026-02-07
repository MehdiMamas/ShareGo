/**
 * subnet discovery utility.
 * scans the local /24 subnet for a websocket server on the given port.
 * platform-specific IP resolution is injected via getLocalIp callback.
 *
 * note: actual session verification happens during the HELLO handshake
 * (session.ts rejects messages with mismatched session IDs).
 */

import { DISCOVERY_HOST_TIMEOUT_MS } from "../config.js";

export interface DiscoveryOptions {
  /** session code (currently used for signature consistency; validated during handshake) */
  sessionCode: string;
  /** port to scan */
  port: number;
  /** resolve the local IPv4 address */
  getLocalIp: () => Promise<string | null>;
  /** optional abort signal to cancel discovery */
  signal?: AbortSignal;
  /** per-host timeout in ms */
  timeout?: number;
}

export async function discoverReceiver(
  opts: DiscoveryOptions,
): Promise<string | null> {
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
      // close all sockets — snapshot the array to avoid issues if new
      // sockets are still being pushed during iteration
      const snapshot = [...sockets];
      for (const ws of snapshot) {
        try { ws.close(); } catch { /* best effort */ }
      }
      resolveOuter(result);
    }

    if (signal) {
      if (signal.aborted) { resolveOuter(null); return; }
      signal.addEventListener("abort", () => finish(null), { once: true });
    }

    for (let i = 1; i <= 254; i++) {
      const ip = `${subnet}.${i}`;
      const url = `ws://${ip}:${port}`;
      const ws = new WebSocket(url);
      sockets.push(ws);

      // bail early if finish() was already called (e.g. by abort signal)
      if (found) {
        try { ws.close(); } catch { /* best effort */ }
        continue;
      }

      const timer = setTimeout(() => {
        try { ws.close(); } catch { /* best effort */ }
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
