import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { events, sessions, sites, screenshots } from '@/lib/schema';
import { eq, and, gte, lte, desc, asc, sql } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

interface SiteContext {
  name: string;
  domain: string;
  businessType: string | null;
  description: string | null;
  targetAudience: string | null;
  primaryGoals: string[];
  pageContext: Record<string, string>;
}

interface ClickDetail {
  path: string;
  timestamp: Date;
  element: string;
  elementType?: string;
  href?: string;
}

interface FlowAnalysisInput {
  siteContext: SiteContext;
  sessionDuration: number | null;
  pageViews: number;
  clicks: number;
  uniquePages: string[];
  timePerPage: Record<string, number>;
  backtracks: { from: string; to: string; timestamp: Date }[];
  mostEngagedPage: [string, number] | undefined;
  clicksByPage: Record<string, number>;
  clickDetails: ClickDetail[];
  maxScrollDepth: number;
  exitIntentDetected: boolean;
  entryPage: string | null;
  exitPage: string | null;
  deviceType: string | null;
  referrer: string | null;
  isBounce: boolean | null;
  events: { type: string; path: string; timestamp: Date; data: unknown }[];
}

function generateFallbackAnalysis(data: FlowAnalysisInput) {
  return {
    userMindset: {
      state: 'unknown',
      confidence: 'low',
      description: 'Unable to determine user mindset without AI analysis'
    },
    primaryIntent: {
      goal: 'Unknown',
      confidence: 'low',
      reasoning: 'Fallback analysis - AI unavailable'
    },
    intentSatisfaction: {
      satisfied: 'unknown',
      confidence: 'low',
      evidence: [] as string[]
    },
    journeySummary: `Session lasted ${data.sessionDuration ? Math.round(data.sessionDuration / 1000) : 0} seconds with ${data.pageViews} page views and ${data.clicks} clicks.`,
    behavioralInsights: [
      `Entered on ${data.entryPage || '/'}`,
      `Exited from ${data.exitPage || '/'}`
    ],
    emotionalJourney: [] as { moment: string; emotion: string; evidence: string }[],
    frictionPoints: [] as { issue: string; evidence: string; impact: string }[],
    recommendations: ['Enable AI analysis for detailed insights'],
    source: 'fallback'
  };
}

async function generateFlowAnalysis(data: FlowAnalysisInput) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY is not set');
    return generateFallbackAnalysis(data);
  }

  const prompt = `You are an expert UX researcher and behavioral psychologist analyzing a user's session on a website. Your job is to infer the user's psychological state, their true intentions, and whether those intentions were satisfied based on their behavior.

WEBSITE CONTEXT:
- Site: ${data.siteContext.name} (${data.siteContext.domain})
- Business Type: ${data.siteContext.businessType || 'Not specified - infer from domain and behavior'}
- Description: ${data.siteContext.description || 'Not provided'}
- Target Audience: ${data.siteContext.targetAudience || 'Not specified'}
- Primary Goals: ${data.siteContext.primaryGoals.length > 0 ? data.siteContext.primaryGoals.join(', ') : 'Not specified'}
${Object.keys(data.siteContext.pageContext).length > 0 ? `- Page Meanings: ${JSON.stringify(data.siteContext.pageContext)}` : ''}

SESSION OVERVIEW:
- Total Duration: ${data.sessionDuration ? Math.round(data.sessionDuration / 1000) : 0} seconds
- Device: ${data.deviceType || 'unknown'}
- Referrer: ${data.referrer || 'direct (typed URL or bookmark)'}
- Entry Page: ${data.entryPage || '/'}
- Exit Page: ${data.exitPage || '/'}
- Bounced (single page, no interaction): ${data.isBounce ? 'Yes' : 'No'}
- Max Scroll Depth: ${data.maxScrollDepth}%
- Exit Intent Detected (mouse moved to close): ${data.exitIntentDetected ? 'Yes' : 'No'}

PAGES VISITED & TIME SPENT:
${Object.entries(data.timePerPage).map(([page, time]) => `- ${page}: ${Math.round(time / 1000)}s`).join('\n') || 'Single page visit'}

CLICK BEHAVIOR (what they clicked and where):
${data.clickDetails.map((c, i) => `${i + 1}. Clicked "${c.element}" (${c.elementType || 'element'}) on ${c.path}${c.href ? ` → navigating to ${c.href}` : ''}`).join('\n') || 'No clicks recorded'}

NAVIGATION PATTERN:
- Pages visited in order: ${data.uniquePages.join(' → ')}
- Backtracking (went back to previous page): ${data.backtracks.length > 0 ? data.backtracks.map(b => `${b.from} ← ${b.to}`).join(', ') : 'None - linear path'}

FULL EVENT SEQUENCE:
${data.events.slice(0, 30).map((e, i) => {
  let detail = '';
  const eventData = e.data as Record<string, unknown> | null;
  if (e.type === 'click' && eventData?.elementText) {
    detail = ` - clicked "${eventData.elementText}"`;
  } else if (e.type === 'scroll_milestone' && eventData?.depth) {
    detail = ` - reached ${eventData.depth}% of page`;
  } else if (e.type === 'pageview' && eventData?.title) {
    detail = ` - "${eventData.title}"`;
  }
  return `${i + 1}. [${e.type}] ${e.path}${detail}`;
}).join('\n')}

Based on this behavioral data, provide a deep psychological analysis in this JSON format:

{
  "userMindset": {
    "state": "One of: exploring, researching, comparing, ready-to-buy, confused, frustrated, curious, skeptical, urgent, casual-browsing",
    "confidence": "high|medium|low",
    "description": "2-3 sentences describing their mental/emotional state throughout the session. What were they thinking? What drove their actions?"
  },
  "primaryIntent": {
    "goal": "Specific goal they were trying to achieve (e.g., 'Find pricing information', 'Understand what the product does', 'Contact the company', 'Compare features')",
    "confidence": "high|medium|low", 
    "reasoning": "What behavioral evidence supports this intent? Be specific about which actions revealed this."
  },
  "intentSatisfaction": {
    "satisfied": "yes|no|partial|unclear",
    "confidence": "high|medium|low",
    "evidence": ["List specific behaviors that indicate whether they found what they were looking for", "e.g., 'Left quickly from pricing page suggests sticker shock' or 'Scrolled to bottom and clicked CTA suggests found what they needed'"]
  },
  "journeySummary": "3-4 sentence narrative of their journey from arrival to exit, written like you're telling a story. Include psychological interpretation of key moments.",
  "behavioralInsights": [
    "Specific insight about their behavior (e.g., 'Spent 45s on About page but only 5s on Services - suggests more interested in company credibility than offerings')",
    "Another specific, non-obvious insight",
    "Pattern you noticed that reveals something about their intent or satisfaction"
  ],
  "emotionalJourney": [
    {"moment": "What happened", "emotion": "Likely emotional state", "evidence": "What behavior suggests this"},
    {"moment": "Another key moment", "emotion": "Emotional state", "evidence": "Supporting behavior"}
  ],
  "frictionPoints": [
    {"issue": "Specific problem they encountered", "evidence": "Behavior that revealed this", "impact": "How it affected their experience"}
  ],
  "recommendations": [
    "Specific, actionable recommendation based on this user's behavior",
    "Another recommendation"
  ]
}

Be a behavioral detective. Look for:
- Hesitation signals (long time on page without action, backtracking)
- Interest signals (deep scrolling, multiple clicks, time spent reading)
- Frustration signals (rapid clicking, exit intent, quick exits)
- Intent clarity (direct navigation vs. wandering)
- Satisfaction signals (completed actions, found what they searched for)

Return ONLY the JSON object.`;

  try {
    console.log('Calling Anthropic API for deep flow analysis...');
    
    const anthropic = new Anthropic({ apiKey });
    
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    console.log('Anthropic API response received');

    const content = response.content[0];
    if (content.type === 'text') {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return { ...parsed, source: 'ai' };
      }
    }
    
    console.error('Could not parse AI response');
    return generateFallbackAnalysis(data);
  } catch (error) {
    console.error('Error calling Anthropic API:', error);
    return generateFallbackAnalysis(data);
  }
}

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

      // Get site context for AI analysis
      const site = await db.query.sites.findFirst({
        where: eq(sites.id, siteId)
      });

      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      // Get screenshots for this session
      const sessionScreenshots = await db
        .select({
          id: screenshots.id,
          eventId: screenshots.eventId,
          path: screenshots.path,
          capturedAt: screenshots.capturedAt,
        })
        .from(screenshots)
        .where(and(
          eq(screenshots.siteId, siteId),
          eq(screenshots.sessionId, sessionId)
        ));

      // Create a map of eventId -> screenshotId for quick lookup
      const screenshotsByEvent = new Map<string, string>();
      sessionScreenshots.forEach(s => {
        if (s.eventId) {
          screenshotsByEvent.set(s.eventId, s.id);
        }
      });

      // Build the flow timeline with screenshot info
      const flowTimeline = sessionEvents.map(event => ({
        id: event.id,
        type: event.eventType,
        timestamp: event.timestamp,
        path: event.path,
        url: event.url,
        data: event.eventData,
        deviceType: event.deviceType,
        screenshotId: screenshotsByEvent.get(event.id) || null
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

      // Extract detailed click information with proper type casting
      const clickDetails: ClickDetail[] = sessionEvents
        .filter(e => e.eventType === 'click')
        .map(e => {
          const eventData = e.eventData as Record<string, unknown> | null;
          return {
            path: e.path,
            timestamp: e.timestamp,
            element: String(eventData?.elementText || eventData?.clickableText || 'unknown element'),
            elementType: eventData?.elementType ? String(eventData.elementType) : eventData?.clickableType ? String(eventData.clickableType) : undefined,
            href: eventData?.href ? String(eventData.href) : undefined
          };
        });

      // Extract scroll behavior
      const scrollEvents = sessionEvents.filter(e => 
        e.eventType === 'scroll' || e.eventType === 'scroll_milestone'
      );
      const maxScrollDepth = scrollEvents.length > 0 
        ? Math.max(...scrollEvents.map(e => {
            const depth = (e.eventData as Record<string, unknown>)?.depth;
            return typeof depth === 'number' ? depth : 0;
          }))
        : 0;

      // Detect exit intent
      const exitIntentEvents = sessionEvents.filter(e => e.eventType === 'exit_intent');

      // Generate AI analysis if requested
      let aiAnalysis = null;
      if (analyze && sessionEvents.length > 0) {
        aiAnalysis = await generateFlowAnalysis({
          siteContext: {
            name: site?.name || 'Unknown',
            domain: site?.domain || '',
            businessType: site?.businessType || null,
            description: site?.description || null,
            targetAudience: site?.targetAudience || null,
            primaryGoals: (site?.primaryGoals as string[]) || [],
            pageContext: (site?.pageContext as Record<string, string>) || {}
          },
          sessionDuration: session.duration,
          pageViews: pageViews.length,
          clicks: clicks.length,
          uniquePages,
          timePerPage,
          backtracks,
          mostEngagedPage,
          clicksByPage,
          clickDetails,
          maxScrollDepth,
          exitIntentDetected: exitIntentEvents.length > 0,
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
          isBounce: session.isBounce,
          country: session.country,
          region: session.region,
          city: session.city
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

        const flowPath = sessionEvents
          .filter(e => ['pageview', 'click', 'form_submit', 'navigation'].includes(e.eventType))
          .slice(0, 10)
          .map(e => ({
            type: e.eventType,
            path: e.path,
            timestamp: e.timestamp,
            detail: e.eventType === 'click' 
              ? String((e.eventData as Record<string, unknown>)?.elementText || '').slice(0, 30) || null
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
          country: session.country,
          region: session.region,
          city: session.city,
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
