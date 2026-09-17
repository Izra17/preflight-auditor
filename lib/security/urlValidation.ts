import dns from 'node:dns/promises';
import net from 'node:net';

export class UnsafeUrlError extends Error {}

const BLOCKED_HOSTNAMES = new Set(['localhost', '0.0.0.0', '::1']);

/**
 * Returns true if an IP address falls into a private/reserved/loopback range.
 * Covers IPv4 RFC1918 + loopback + link-local + CGNAT, and common IPv6
 * loopback/unique-local/link-local ranges. This is intentionally
 * conservative: when in doubt, we block rather than allow.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  const type = net.isIP(ip);
  if (type === 4) {
    const parts = ip.split('.').map(Number);
    const [a, b] = parts;
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b !== undefined && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
    if (a === 0) return true; // "this" network
    return false;
  }
  if (type === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::1') return true; // loopback
    if (lower.startsWith('fe80:')) return true; // link-local
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local
    if (lower.startsWith('::ffff:')) {
      // IPv4-mapped address — recurse on the embedded IPv4
      const v4 = lower.split(':').pop();
      if (v4 && net.isIP(v4) === 4) return isPrivateOrReservedIp(v4);
    }
    return false;
  }
  return true; // couldn't parse — treat as unsafe
}

export interface ValidatedUrl {
  url: URL;
  resolvedIps: string[];
}

/**
 * Validates a user-submitted URL is safe to navigate a real browser to.
 * Blocks non-http(s) protocols, localhost/loopback, private IP ranges,
 * and resolves DNS up front to prevent DNS-rebinding style SSRF where the
 * hostname resolves to a private IP.
 */
export async function validateAuditUrl(raw: string): Promise<ValidatedUrl> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new UnsafeUrlError('That does not look like a valid URL.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeUrlError('Only http:// and https:// URLs are supported.');
  }

  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new UnsafeUrlError('This host is not allowed for auditing.');
  }

  // If the hostname is itself a literal IP, check it directly.
  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new UnsafeUrlError('Private and internal network addresses cannot be audited.');
    }
    return { url, resolvedIps: [hostname] };
  }

  let addresses: string[];
  try {
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    addresses = records.map((r) => r.address);
  } catch {
    throw new UnsafeUrlError('The domain could not be resolved.');
  }

  if (addresses.length === 0) {
    throw new UnsafeUrlError('The domain could not be resolved.');
  }

  if (addresses.some(isPrivateOrReservedIp)) {
    throw new UnsafeUrlError('This domain resolves to a private/internal address and cannot be audited.');
  }

  return { url, resolvedIps: addresses };
}
