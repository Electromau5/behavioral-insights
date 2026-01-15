import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { events, sessions, sites } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { getClientIP, getGeoLocation } from '@/lib/geolocation';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { siteId, sessionId, visitorId, timestamp, eventType, url, path, referrer, userAgent, deviceType, screenWidth, screenHeight, viewportWidth, viewportHeight, language, timezone, eventData } = body;

    if (!siteId || !sessionId || !visitorId || !eventType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers: corsHeaders });
    }

    const site = await db.query.sites.findFirst({
      where: and(eq(sites.id, siteId), eq(sites.isActive, true)),
    });

    if (!site) {
      return NextResponse.json({ error: 'Invalid site ID' }, { status: 403, headers: corsHeaders });
    }

    await db.insert(events).values({
      siteId, sessionId, visitorId, eventType,
      timestamp: new Date(timestamp),
      url, path, referrer, userAgent, deviceType,
      screenWidth, screenHeight, viewportWidth, viewportHeight,
      language, timezone, eventData: eventData || {},
    });

    const existingSession = await db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) });

    if (!existingSession) {
      // Get geolocation for new sessions
      const clientIP = getClientIP(request);
      const geo = clientIP ? await getGeoLocation(clientIP) : { country: null, region: null, city: null };

      await db.insert(sessions).values({
        id: sessionId, siteId, visitorId,
        startedAt: new Date(timestamp),
        entryPage: path, exitPage: path,
        referrer, deviceType,
        pageViews: eventType === 'pageview' ? 1 : 0,
        clicks: eventType === 'click' ? 1 : 0,
        isBounce: true,
        country: geo.country,
        region: geo.region,
        city: geo.city,
      });
    } else {
      const updates: Record<string, unknown> = {
        endedAt: new Date(timestamp),
        exitPage: path,
        duration: new Date(timestamp).getTime() - existingSession.startedAt.getTime(),
      };

      if (eventType === 'pageview') {
        updates.pageViews = existingSession.pageViews + 1;
        updates.isBounce = false;
      }
      if (eventType === 'click') {
        updates.clicks = existingSession.clicks + 1;
      }
      if (eventType === 'scroll' && eventData?.depth) {
        if ((eventData.depth as number) > (existingSession.maxScrollDepth || 0)) {
          updates.maxScrollDepth = eventData.depth as number;
        }
      }

      await db.update(sessions).set(updates).where(eq(sessions.id, sessionId));
    }

    return NextResponse.json({ success: true }, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('Error collecting event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders });
  }
}
