/**
 * subnet discovery utility.
 * scans the local /24 subnet for a websocket server on the given port.
 * platform-specific IP resolution is injected via getLocalIp callback.
 *
 * note: actual session verification happens during the HELLO handshake
 * (session.ts rejects messages with mismatched session IDs).
 */

export interface DiscoveryOptions {
  /** session code (currently used for signature consistency; validated during handshake) */
  sessionCode: string;
  /** port to scan */
  port: number;
  /** resolve the local IPv4 address */
  getLocalIp: () => Promise<string | null>;
  /** optional abort signal to cancel discovery */
  signal?: AbortSignal;
  /** per-host timeout in ms (default 1500) */
  timeout?: number;
}

export async function discoverReceiver(
  opts: DiscoveryOptions,
): Promise<string | null> {
  const { port, getLocalIp, signal, timeout = 1500 } = opts;

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
      for (const ws of sockets) {
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

      const timer = setTimeout(() => {
        ws.close();
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
