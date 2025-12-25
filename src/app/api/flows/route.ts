import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { events, sessions } from '@/lib/schema';
import { eq, and, gte, lte, desc, asc, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');
    const sessionId = searchParams.get('sessionId');
    const period = searchParams.get('period') || '7d';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!siteId) {
      return NextResponse.json({ error: 'Site ID is required' }, { status: 400 });
    }

    // If sessionId provided, return detailed flow for that session
    if (sessionId) {
      const sessionEvents = await db
        .select()
        .from(events)
        .where(and(eq(events.siteId, siteId), eq(events.sessionId, sessionId)))
        .orderBy(asc(events.timestamp));

      const session = await db.query.sessions.findFirst({
        where: and(eq(sessions.siteId, siteId), eq(sessions.id, sessionId))
      });

      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      // Build the flow timeline
      const flowTimeline = sessionEvents.map(event => ({
        id: event.id,
        type: event.eventType,
        timestamp: event.timestamp,
        path: event.path,
        url: event.url,
        data: event.eventData,
        deviceType: event.deviceType
      }));

      // Calculate flow summary
      const pageViews = sessionEvents.filter(e => e.eventType === 'pageview');
      const clicks = sessionEvents.filter(e => e.eventType === 'click');
      const uniquePages = [...new Set(pageViews.map(p => p.path))];

      return NextResponse.json({
        session: {
          id: session.id,
          visitorId: session.visitorId,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          duration: session.duration,
          entryPage: session.entryPage,
          exitPage: session.exitPage,
          deviceType: session.deviceType,
          referrer: session.referrer,
          isBounce: session.isBounce
        },
        summary: {
          totalEvents: sessionEvents.length,
          pageViews: pageViews.length,
          clicks: clicks.length,
          uniquePages: uniquePages.length,
          pagesVisited: uniquePages
        },
        timeline: flowTimeline
      });
    }

    // Return list of all sessions/flows
    const now = new Date();
    const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const offset = (page - 1) * limit;

    const allSessions = await db
      .select()
      .from(sessions)
      .where(and(
        eq(sessions.siteId, siteId),
        gte(sessions.startedAt, start),
        lte(sessions.startedAt, now)
      ))
      .orderBy(desc(sessions.startedAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(sessions)
      .where(and(
        eq(sessions.siteId, siteId),
        gte(sessions.startedAt, start),
        lte(sessions.startedAt, now)
      ));

    // For each session, get a brief summary of the flow
    const flowsWithSummary = await Promise.all(
      allSessions.map(async (session) => {
        const sessionEvents = await db
          .select({
            eventType: events.eventType,
            path: events.path,
            timestamp: events.timestamp,
            eventData: events.eventData
          })
          .from(events)
          .where(and(eq(events.siteId, siteId), eq(events.sessionId, session.id)))
          .orderBy(asc(events.timestamp));

        const pageViews = sessionEvents.filter(e => e.eventType === 'pageview');
        const clicks = sessionEvents.filter(e => e.eventType === 'click');
        const uniquePages = [...new Set(pageViews.map(p => p.path))];

        // Create a simplified flow path
        const flowPath = sessionEvents
          .filter(e => ['pageview', 'click', 'form_submit', 'navigation'].includes(e.eventType))
          .slice(0, 10) // Limit to first 10 key events
          .map(e => ({
            type: e.eventType,
            path: e.path,
            timestamp: e.timestamp,
            detail: e.eventType === 'click' 
              ? (e.eventData as { elementText?: string })?.elementText?.slice(0, 30) 
              : null
          }));

        return {
          sessionId: session.id,
          visitorId: session.visitorId,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          duration: session.duration,
          entryPage: session.entryPage,
          exitPage: session.exitPage,
          deviceType: session.deviceType,
          referrer: session.referrer,
          isBounce: session.isBounce,
          totalEvents: sessionEvents.length,
          pageViews: pageViews.length,
          clicks: clicks.length,
          uniquePages: uniquePages.length,
          flowPath: flowPath
        };
      })
    );

    return NextResponse.json({
      flows: flowsWithSummary,
      pagination: {
        page,
        limit,
        total: Number(countResult.count),
        totalPages: Math.ceil(Number(countResult.count) / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching flows:', error);
    return NextResponse.json({ error: 'Failed to fetch flows' }, { status: 500 });
  }
}
