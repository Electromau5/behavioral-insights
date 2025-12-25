import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { events, sessions } from '@/lib/schema';
import { eq, and, gte, lte, desc, asc, sql } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');
    const sessionId = searchParams.get('sessionId');
    const period = searchParams.get('period') || '7d';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const analyze = searchParams.get('analyze') === 'true';

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

      // Calculate time spent per page
      const timePerPage: Record<string, number> = {};
      for (let i = 0; i < sessionEvents.length; i++) {
        const event = sessionEvents[i];
        if (event.eventType === 'pageview') {
          const nextEvent = sessionEvents[i + 1];
          if (nextEvent) {
            const duration = new Date(nextEvent.timestamp).getTime() - new Date(event.timestamp).getTime();
            timePerPage[event.path] = (timePerPage[event.path] || 0) + duration;
          }
        }
      }

      // Detect backtracking (returning to previously visited pages)
      const visitedPages: string[] = [];
      const backtracks: { from: string; to: string; timestamp: Date }[] = [];
      for (const event of sessionEvents) {
        if (event.eventType === 'pageview') {
          if (visitedPages.includes(event.path)) {
            const lastPage = visitedPages[visitedPages.length - 1];
            if (lastPage !== event.path) {
              backtracks.push({
                from: lastPage,
                to: event.path,
                timestamp: event.timestamp
              });
            }
          }
          visitedPages.push(event.path);
        }
      }

      // Find most engaged page (highest time spent)
      const mostEngagedPage = Object.entries(timePerPage).sort((a, b) => b[1] - a[1])[0];

      // Analyze click patterns
      const clicksByPage: Record<string, number> = {};
      for (const event of sessionEvents) {
        if (event.eventType === 'click') {
          clicksByPage[event.path] = (clicksByPage[event.path] || 0) + 1;
        }
      }

      // Generate AI analysis if requested
      let aiAnalysis = null;
      if (analyze && sessionEvents.length > 0) {
        aiAnalysis = await generateFlowAnalysis({
          sessionDuration: session.duration,
          pageViews: pageViews.length,
          clicks: clicks.length,
          uniquePages,
          timePerPage,
          backtracks,
          mostEngagedPage,
          clicksByPage,
          entryPage: session.entryPage,
          exitPage: session.exitPage,
          deviceType: session.deviceType,
          referrer: session.referrer,
          isBounce: session.isBounce,
          events: sessionEvents.map(e => ({
            type: e.eventType,
            path: e.path,
            timestamp: e.timestamp,
            data: e.eventData
          }))
        });
      }

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
          pagesVisited: uniquePages,
          timePerPage,
          mostEngagedPage: mostEngagedPage ? { path: mostEngagedPage[0], duration: mostEngagedPage[1] } : null,
          backtracks,
          clicksByPage
        },
        timeline: flowTimeline,
        analysis: aiAnalysis
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
          .slice(0, 10)
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

interface FlowAnalysisInput {
  sessionDuration: number | null;
  pageViews: number;
  clicks: number;
  uniquePages: string[];
  timePerPage: Record<string, number>;
  backtracks: { from: string; to: string; timestamp: Date }[];
  mostEngagedPage: [string, number] | null;
  clicksByPage: Record<string, number>;
  entryPage: string | null;
  exitPage: string | null;
  deviceType: string | null;
  referrer: string | null;
  isBounce: boolean | null;
  events: { type: string; path: string; timestamp: Date; data: unknown }[];
}

async function generateFlowAnalysis(data: FlowAnalysisInput) {
  const prompt = `Analyze this user session and provide insights. Be specific and actionable.

SESSION DATA:
- Duration: ${data.sessionDuration ? Math.round(data.sessionDuration / 1000) : 0} seconds
- Pages viewed: ${data.pageViews}
- Total clicks: ${data.clicks}
- Unique pages: ${data.uniquePages.join(', ')}
- Entry page: ${data.entryPage || '/'}
- Exit page: ${data.exitPage || '/'}
- Device: ${data.deviceType || 'unknown'}
- Referrer: ${data.referrer || 'direct'}
- Bounced: ${data.isBounce ? 'Yes' : 'No'}

TIME PER PAGE:
${Object.entries(data.timePerPage).map(([page, time]) => `- ${page}: ${Math.round(time / 1000)}s`).join('\n')}

BACKTRACKING (returned to previously visited pages):
${data.backtracks.length > 0 ? data.backtracks.map(b => `- Went from ${b.from} back to ${b.to}`).join('\n') : 'None'}

CLICKS PER PAGE:
${Object.entries(data.clicksByPage).map(([page, count]) => `- ${page}: ${count} clicks`).join('\n')}

EVENT SEQUENCE (first 20):
${data.events.slice(0, 20).map((e, i) => `${i + 1}. ${e.type} on ${e.path}`).join('\n')}

Based on this data, provide analysis in the following JSON format:
{
  "intent": "Brief description of what the user was likely trying to accomplish (1-2 sentences)",
  "intentConfidence": "high|medium|low",
  "summary": "2-3 sentence summary of the user's journey",
  "engagement": "high|medium|low",
  "engagementReason": "Why you rated engagement this way",
  "keyInsights": [
    "Specific insight 1",
    "Specific insight 2",
    "Specific insight 3"
  ],
  "mostEngagedSection": "Which part of the site they spent most time on",
  "frictionPoints": ["Any points where user seemed confused or frustrated"],
  "recommendations": ["Actionable recommendation based on this session"]
}

Return ONLY the JSON object, no other text.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
  } catch (error) {
    console.error('Error generating flow analysis:', error);
  }

  // Fallback analysis
  return {
    intent: data.isBounce 
      ? "User briefly visited but didn't find what they were looking for"
      : `User explored ${data.uniquePages.length} pages, likely researching or browsing`,
    intentConfidence: 'low',
    summary: `Session lasted ${data.sessionDuration ? Math.round(data.sessionDuration / 1000) : 0} seconds with ${data.pageViews} page views and ${data.clicks} clicks.`,
    engagement: data.sessionDuration && data.sessionDuration > 60000 ? 'high' : data.sessionDuration && data.sessionDuration > 20000 ? 'medium' : 'low',
    engagementReason: `Based on session duration and interaction count`,
    keyInsights: [
      `Entered on ${data.entryPage || '/'}`,
      data.backtracks.length > 0 ? `Backtracked ${data.backtracks.length} time(s)` : 'Linear navigation pattern',
      `Most active on ${Object.entries(data.clicksByPage).sort((a, b) => b[1] - a[1])[0]?.[0] || data.entryPage || '/'}`
    ],
    mostEngagedSection: data.mostEngagedPage ? data.mostEngagedPage[0] : data.entryPage || '/',
    frictionPoints: data.backtracks.length > 2 ? ['Multiple backtracks suggest navigation confusion'] : [],
    recommendations: ['Monitor this user pattern for optimization opportunities']
  };
}
