/**
 * LAN IP detection for desktop (Electron main process).
 * port of the Rust net_utils.rs implementation.
 *
 * prefers physical interfaces (Wi-Fi, Ethernet) over VPN tunnels
 * and virtual adapters for local-network-only communication.
 */

import os from "os";

interface Candidate {
  score: number;
  address: string;
}

/**
 * detect the local LAN IP address.
 * returns the best private IPv4 address from a physical interface,
 * or null if none found.
 */
export function getLanIp(): string | null {
  const interfaces = os.networkInterfaces();
  const candidates: Candidate[] = [];

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;

    for (const addr of addrs) {
      // skip non-IPv4 (Node.js 18+ may return numeric 4 instead of "IPv4")
      if (addr.family !== "IPv4" && (addr.family as unknown) !== 4) continue;

      // skip loopback
      if (addr.internal) continue;

      // skip link-local (169.254.x.x)
      if (addr.address.startsWith("169.254.")) continue;

      // only consider private ranges
      if (!isPrivateIpv4(addr.address)) continue;

      const score = interfacePriority(name);
      // skip interfaces with negative priority (VPN, virtual)
      if (score < 0) continue;

      candidates.push({ score, address: addr.address });
    }
  }

  // pick the highest-priority interface
  candidates.sort((a, b) => b.score - a.score);
  return candidates.length > 0 ? candidates[0].address : null;
}

/**
 * score an interface name by priority (higher = better).
 * returns negative for interfaces we want to skip.
 */
function interfacePriority(name: string): number {
  const lower = name.toLowerCase();

  // VPN and tunnel interfaces — skip
  if (
    lower.startsWith("utun") ||
    lower.startsWith("tun") ||
    lower.startsWith("tap") ||
    lower.startsWith("ipsec") ||
    lower.startsWith("ppp") ||
    lower.startsWith("gpd") ||
    lower.startsWith("wg")
  ) {
    return -1;
  }

  // virtual interfaces — skip
  if (
    lower.startsWith("vmnet") ||
    lower.startsWith("veth") ||
    lower.startsWith("docker") ||
    lower.startsWith("br-") ||
    lower.startsWith("virbr") ||
    lower.startsWith("vbox") ||
    lower === "lo" ||
    lower === "lo0"
  ) {
    return -1;
  }

  // Wi-Fi (macOS: en0, linux: wlan*)
  if (lower === "en0" || lower.startsWith("wlan") || lower.startsWith("wlp")) {
    return 100;
  }

  // ethernet (macOS: en1-enN, linux: eth*, enp*)
  if (lower.startsWith("en") || lower.startsWith("eth") || lower.startsWith("enp")) {
    return 90;
  }

  // windows Wi-Fi/ethernet — many possible naming conventions
  if (
    lower.includes("wi-fi") ||
    lower.includes("wifi") ||
    lower.includes("wireless") ||
    lower.includes("wlan")
  ) {
    return 100;
  }

  if (
    lower.includes("ethernet") ||
    lower.includes("local area connection") ||
    lower.includes("realtek") ||
    lower.includes("intel")
  ) {
    return 95;
  }

  // anything else that passed the filters
  return 10;
}

/**
 * check if an IPv4 address is in a private range.
 */
function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4) return false;

  // 10.0.0.0/8
  if (parts[0] === 10) return true;

  // 172.16.0.0/12
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;

  // 192.168.0.0/16
  if (parts[0] === 192 && parts[1] === 168) return true;

  return false;
}
