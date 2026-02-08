/**
 * mDNS discovery adapter for desktop (Electron main process).
 * uses bonjour-service to advertise and browse for ShareGo services.
 */

import type {
  DiscoveryAdapter,
  DiscoveredService,
} from "@sharego/core";
import {
  MDNS_TXT_KEYS,
  asSessionId,
  asBase64PublicKey,
  asNetworkAddress,
} from "@sharego/core";

// bonjour-service types (lazy import to avoid bundling in renderer)
let Bonjour: any;
let bonjourInstance: any;

async function getBonjourInstance() {
  if (!bonjourInstance) {
    // dynamic import so this only loads in the main process
    const mod = await import("bonjour-service");
    Bonjour = mod.Bonjour || mod.default;
    bonjourInstance = new Bonjour();
  }
  return bonjourInstance;
}

/**
 * Electron mDNS discovery adapter using bonjour-service.
 * this runs in the main process and is exposed to the renderer via IPC.
 */
export class ElectronMdnsAdapter implements DiscoveryAdapter {
  private service: any = null;
  private browser: any = null;

  async advertise(
    serviceName: string,
    port: number,
    meta: Record<string, string>,
  ): Promise<void> {
    const bonjour = await getBonjourInstance();
    this.service = bonjour.publish({
      name: `ShareGo-${meta[MDNS_TXT_KEYS.sid] ?? "unknown"}`,
      type: serviceName.replace(/^_/, "").replace(/\._tcp$/, ""),
      port,
      txt: meta,
    });
  }

  async *browse(serviceName: string): AsyncIterable<DiscoveredService> {
    const bonjour = await getBonjourInstance();

    // create an async queue for discovered services
    const queue: DiscoveredService[] = [];
    let resolve: (() => void) | null = null;
    let done = false;

    this.browser = bonjour.find({
      type: serviceName.replace(/^_/, "").replace(/\._tcp$/, ""),
    }, (service: any) => {
      if (done) return;

      const txt = service.txt || {};
      const address = service.addresses?.find((a: string) => a.includes("."));
      if (!address) return;

      const discovered: DiscoveredService = {
        name: service.name || "unknown",
        address: asNetworkAddress(`${address}:${service.port}`),
        sessionId: asSessionId(txt[MDNS_TXT_KEYS.sid] || ""),
        publicKey: txt[MDNS_TXT_KEYS.pk]
          ? asBase64PublicKey(txt[MDNS_TXT_KEYS.pk])
          : undefined,
      };

      queue.push(discovered);
      if (resolve) {
        resolve();
        resolve = null;
      }
    });

    try {
      while (!done) {
        if (queue.length > 0) {
          yield queue.shift()!;
        } else {
          await new Promise<void>((r) => { resolve = r; });
        }
      }
    } finally {
      done = true;
    }
  }

  stopAdvertising(): void {
    if (this.service) {
      this.service.stop?.();
      this.service = null;
    }
  }

  stopBrowsing(): void {
    if (this.browser) {
      this.browser.stop?.();
      this.browser = null;
    }
  }
}
