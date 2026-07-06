import { NextRequest, NextResponse } from 'next/server';
import { getClientIP } from '@/lib/geolocation';

export async function GET(request: NextRequest) {
  return NextResponse.json({ ip: getClientIP(request) });
}
