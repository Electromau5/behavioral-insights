/**
 * IP exclusion matching for tracking.
 * Supports exact IPv4/IPv6 addresses and IPv4 CIDR ranges (e.g. "203.0.113.0/24").
 */

/** Strip the IPv6-mapped-IPv4 prefix some proxies emit (::ffff:1.2.3.4 -> 1.2.3.4) */
function normalizeIp(ip: string): string {
  const trimmed = ip.trim().toLowerCase();
  return trimmed.startsWith('::ffff:') ? trimmed.slice(7) : trimmed;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    result = result * 256 + n;
  }
  return result;
}

function matchesCidr(ip: string, cidr: string): boolean {
  const [range, prefixStr] = cidr.split('/');
  const prefix = Number(prefixStr);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
  const ipInt = ipv4ToInt(ip);
  const rangeInt = ipv4ToInt(range);
  if (ipInt === null || rangeInt === null) return false;
  if (prefix === 0) return true;
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  return ((ipInt & mask) >>> 0) === ((rangeInt & mask) >>> 0);
}

/** Check whether an IP matches any entry in an exclusion list (exact IP or IPv4 CIDR). */
export function isIpExcluded(clientIp: string, excludedIps: unknown): boolean {
  if (!Array.isArray(excludedIps) || excludedIps.length === 0) return false;
  const ip = normalizeIp(clientIp);

  for (const entry of excludedIps) {
    if (typeof entry !== 'string' || !entry.trim()) continue;
    const rule = normalizeIp(entry);
    if (rule.includes('/')) {
      if (matchesCidr(ip, rule)) return true;
    } else if (ip === rule) {
      return true;
    }
  }
  return false;
}

/** Validate an exclusion list entry before saving: exact IPv4/IPv6 or IPv4 CIDR. */
export function isValidExclusionEntry(entry: string): boolean {
  const value = normalizeIp(entry);
  if (!value) return false;

  if (value.includes('/')) {
    const [range, prefixStr] = value.split('/');
    const prefix = Number(prefixStr);
    return ipv4ToInt(range) !== null && Number.isInteger(prefix) && prefix >= 0 && prefix <= 32;
  }

  if (ipv4ToInt(value) !== null) return true;

  // Basic IPv6 shape check: hex groups separated by colons
  return /^[0-9a-f:]+$/.test(value) && value.includes(':');
}
