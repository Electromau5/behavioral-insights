export interface GeoLocation {
  country: string | null;
  region: string | null;
  city: string | null;
}

interface IpApiResponse {
  status: 'success' | 'fail';
  country?: string;
  regionName?: string;
  city?: string;
  message?: string;
}

/**
 * Get geolocation data from an IP address using ip-api.com
 * Free tier: 45 requests/minute, no API key required
 */
export async function getGeoLocation(ip: string): Promise<GeoLocation> {
  // Skip localhost and private IPs
  if (isPrivateIP(ip)) {
    return { country: null, region: null, city: null };
  }

  try {
    const response = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,message,country,regionName,city`,
      { next: { revalidate: 86400 } } // Cache for 24 hours
    );

    if (!response.ok) {
      console.error('Geolocation API error:', response.status);
      return { country: null, region: null, city: null };
    }

    const data: IpApiResponse = await response.json();

    if (data.status === 'fail') {
      console.error('Geolocation lookup failed:', data.message);
      return { country: null, region: null, city: null };
    }

    return {
      country: data.country || null,
      region: data.regionName || null,
      city: data.city || null,
    };
  } catch (error) {
    console.error('Geolocation fetch error:', error);
    return { country: null, region: null, city: null };
  }
}

/**
 * Extract client IP from request headers
 * Handles common proxy headers (Vercel, Cloudflare, etc.)
 */
export function getClientIP(request: Request): string | null {
  // Vercel/Next.js
  const xForwardedFor = request.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first (client)
    return xForwardedFor.split(',')[0].trim();
  }

  // Cloudflare
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // Generic real IP header
  const xRealIP = request.headers.get('x-real-ip');
  if (xRealIP) {
    return xRealIP;
  }

  return null;
}

/**
 * Check if an IP is private/local (not routable on public internet)
 */
function isPrivateIP(ip: string): boolean {
  // IPv4 private ranges
  if (
    ip === '127.0.0.1' ||
    ip === 'localhost' ||
    ip.startsWith('10.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('172.17.') ||
    ip.startsWith('172.18.') ||
    ip.startsWith('172.19.') ||
    ip.startsWith('172.20.') ||
    ip.startsWith('172.21.') ||
    ip.startsWith('172.22.') ||
    ip.startsWith('172.23.') ||
    ip.startsWith('172.24.') ||
    ip.startsWith('172.25.') ||
    ip.startsWith('172.26.') ||
    ip.startsWith('172.27.') ||
    ip.startsWith('172.28.') ||
    ip.startsWith('172.29.') ||
    ip.startsWith('172.30.') ||
    ip.startsWith('172.31.') ||
    ip.startsWith('192.168.') ||
    ip === '::1'
  ) {
    return true;
  }
  return false;
}
