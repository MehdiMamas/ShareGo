import { describe, it, expect, vi, beforeEach } from "vitest";
import { discoverReceiver, advertiseReceiver, stopAdvertising } from "./discovery.js";
import { MDNS_SERVICE_TYPE, MDNS_TXT_KEYS } from "./types.js";
import type { DiscoveryAdapter, DiscoveredService } from "./types.js";
import { asSessionId, asNetworkAddress, asBase64PublicKey } from "../types/index.js";
import { PROTOCOL_VERSION } from "../protocol/types.js";

/** helper to create a mock discovery adapter */
function createMockAdapter(services: DiscoveredService[] = []): DiscoveryAdapter {
  return {
    advertise: vi.fn().mockResolvedValue(undefined),
    browse: vi.fn().mockImplementation(function* () {
      for (const svc of services) {
        yield svc;
      }
    }),
    stopAdvertising: vi.fn(),
    stopBrowsing: vi.fn(),
  };
}

/** helper to create a mock async iterable adapter */
function createAsyncMockAdapter(services: DiscoveredService[]): DiscoveryAdapter {
  return {
    advertise: vi.fn().mockResolvedValue(undefined),
    browse: vi.fn().mockImplementation(() => {
      let idx = 0;
      return {
        [Symbol.asyncIterator]() {
          return {
            async next() {
              if (idx < services.length) {
                return { value: services[idx++], done: false };
              }
              return { value: undefined, done: true };
            },
          };
        },
      };
    }),
    stopAdvertising: vi.fn(),
    stopBrowsing: vi.fn(),
  };
}

const TEST_SESSION = asSessionId("ABC123");
const TEST_ADDRESS = asNetworkAddress("192.168.1.50:4040");
const TEST_PK = asBase64PublicKey("dGVzdHB1YmxpY2tleQ");

describe("discoverReceiver", () => {
  it("should find a receiver via mDNS when adapter is provided", async () => {
    const service: DiscoveredService = {
      name: "ShareGo-ABC123",
      address: TEST_ADDRESS,
      sessionId: TEST_SESSION,
      publicKey: TEST_PK,
    };

    const adapter = createAsyncMockAdapter([service]);
    const result = await discoverReceiver({
      sessionCode: TEST_SESSION,
      port: 4040,
      getLocalIp: async () => "192.168.1.100",
      discoveryAdapter: adapter,
    });

    expect(result).not.toBeNull();
    expect(result!.sessionId).toBe(TEST_SESSION);
    expect(result!.address).toBe(TEST_ADDRESS);
    expect(result!.publicKey).toBe(TEST_PK);
  });

  it("should skip non-matching services via mDNS", async () => {
    const otherService: DiscoveredService = {
      name: "ShareGo-XYZ999",
      address: asNetworkAddress("192.168.1.60:4040"),
      sessionId: asSessionId("XYZ999"),
    };

    const adapter = createAsyncMockAdapter([otherService]);

    // since mDNS won't find our session and subnet scan needs a real WebSocket,
    // provide getLocalIp that returns null to skip subnet scan too
    const result = await discoverReceiver({
      sessionCode: TEST_SESSION,
      port: 4040,
      getLocalIp: async () => null,
      discoveryAdapter: adapter,
    });

    expect(result).toBeNull();
  });

  it("should return null when no adapter and no local IP", async () => {
    const result = await discoverReceiver({
      sessionCode: TEST_SESSION,
      port: 4040,
      getLocalIp: async () => null,
    });

    expect(result).toBeNull();
  });

  it("should return null when local IP is malformed", async () => {
    const result = await discoverReceiver({
      sessionCode: TEST_SESSION,
      port: 4040,
      getLocalIp: async () => "not-an-ip",
    });

    expect(result).toBeNull();
  });

  it("should respect abort signal (already aborted)", async () => {
    const controller = new AbortController();
    controller.abort();

    const adapter = createAsyncMockAdapter([]);

    const result = await discoverReceiver({
      sessionCode: TEST_SESSION,
      port: 4040,
      getLocalIp: async () => null,
      discoveryAdapter: adapter,
      signal: controller.signal,
    });

    expect(result).toBeNull();
  });
});

describe("advertiseReceiver", () => {
  it("should call adapter.advertise with correct parameters", async () => {
    const adapter = createMockAdapter();

    await advertiseReceiver(adapter, 4040, TEST_SESSION, TEST_PK);

    expect(adapter.advertise).toHaveBeenCalledWith(
      MDNS_SERVICE_TYPE,
      4040,
      {
        [MDNS_TXT_KEYS.sid]: TEST_SESSION,
        [MDNS_TXT_KEYS.pk]: TEST_PK,
        [MDNS_TXT_KEYS.v]: String(PROTOCOL_VERSION),
      },
    );
  });
});

describe("stopAdvertising", () => {
  it("should call adapter.stopAdvertising", () => {
    const adapter = createMockAdapter();
    stopAdvertising(adapter);
    expect(adapter.stopAdvertising).toHaveBeenCalled();
  });
});
