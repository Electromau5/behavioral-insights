import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { events, sessions, sites } from '@/lib/schema';
import { eq, and, desc } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(request: Request) {
  try {
    const { sessionId, siteId, message, conversationHistory } = await request.json();

    if (!sessionId || !siteId || !message) {
      return NextResponse.json(
        { error: 'sessionId, siteId, and message are required' },
        { status: 400 }
      );
    }

    // Fetch session data
    const session = await db.query.sessions.findFirst({
      where: and(eq(sessions.id, sessionId), eq(sessions.siteId, siteId)),
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Fetch site context
    const site = await db.query.sites.findFirst({
      where: eq(sites.id, siteId),
    });

    // Fetch all events for this session
    const sessionEvents = await db
      .select()
      .from(events)
      .where(and(eq(events.sessionId, sessionId), eq(events.siteId, siteId)))
      .orderBy(desc(events.timestamp))
      .limit(100);

    // Build session context
    const sessionContext = buildSessionContext(session, sessionEvents, site);

    // Build conversation messages for Claude
    const messages: Anthropic.MessageParam[] = [];

    // Add conversation history
    if (conversationHistory && Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory as ChatMessage[]) {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    // Add current message
    messages.push({
      role: 'user',
      content: message,
    });

    // Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: `You are an expert UX researcher and behavioral analyst helping to understand user session data from a website analytics platform.

You have access to detailed session data including:
- User's navigation path through the website
- Clicks, scrolls, and interactions
- Time spent on each page
- Frustration signals (rage clicks, dead clicks, mouse thrashing)
- Form interactions
- Device and location information

Your role is to answer questions about this specific session in a helpful, insightful way. Focus on:
- Understanding user intent and goals
- Identifying frustration points
- Explaining behavior patterns
- Providing actionable insights

Be conversational but concise. Use the session data to support your answers with specific evidence.

${sessionContext}`,
      messages,
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return NextResponse.json({ error: 'Unexpected response format' }, { status: 500 });
    }

    return NextResponse.json({ response: content.text });
  } catch (error) {
    console.error('Chat API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

function buildSessionContext(
  session: typeof sessions.$inferSelect,
  sessionEvents: (typeof events.$inferSelect)[],
  site: typeof sites.$inferSelect | undefined
): string {
  const frustrationType = ['rage_click', 'dead_click', 'mouse_thrash', 'exit_intent'];
  const frustrationEvents = sessionEvents.filter((e) => frustrationType.includes(e.eventType));
  const pageViews = sessionEvents.filter((e) => e.eventType === 'pageview');
  const clicks = sessionEvents.filter((e) => e.eventType === 'click');
  const scrolls = sessionEvents.filter((e) => e.eventType === 'scroll_milestone');
  const formEvents = sessionEvents.filter((e) => e.eventType.startsWith('form_'));

  // Calculate time per page
  const timePerPage: Record<string, number> = {};
  const sortedPageViews = [...pageViews].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  for (let i = 0; i < sortedPageViews.length; i++) {
    const current = sortedPageViews[i];
    const next = sortedPageViews[i + 1];
    const endTime = next ? new Date(next.timestamp).getTime() : (session.endedAt ? new Date(session.endedAt).getTime() : Date.now());
    const duration = endTime - new Date(current.timestamp).getTime();
    timePerPage[current.path] = (timePerPage[current.path] || 0) + duration;
  }

  // Build event timeline (limited to key events)
  const keyEvents = sessionEvents
    .filter((e) => ['pageview', 'click', 'form_submit', 'form_abandonment', ...frustrationType].includes(e.eventType))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(0, 30);

  const eventTimeline = keyEvents.map((e) => {
    const data = e.eventData as Record<string, unknown> | null;
    let detail = '';
    if (e.eventType === 'click' && data?.elementText) {
      detail = ` - clicked "${String(data.elementText).slice(0, 50)}"`;
    } else if (e.eventType === 'pageview' && data?.title) {
      detail = ` - "${data.title}"`;
    } else if (e.eventType === 'scroll_milestone' && data?.depth) {
      detail = ` - ${data.depth}% depth`;
    } else if (e.eventType === 'form_abandonment' && data?.reason) {
      detail = ` - reason: ${data.reason}`;
    }
    return `- ${new Date(e.timestamp).toLocaleTimeString()}: ${e.eventType} on ${e.path}${detail}`;
  }).join('\n');

  return `
## CURRENT SESSION DATA

### Session Overview
- Session ID: ${session.id}
- Device: ${session.deviceType || 'Unknown'}
- Location: ${[session.city, session.region, session.country].filter(Boolean).join(', ') || 'Unknown'}
- Started: ${new Date(session.startedAt).toLocaleString()}
- Duration: ${session.duration ? Math.round(session.duration / 1000) + ' seconds' : 'Unknown'}
- Entry Page: ${session.entryPage || '/'}
- Exit Page: ${session.exitPage || 'Unknown'}
- Bounce: ${session.isBounce ? 'Yes' : 'No'}
- Referrer: ${session.referrer || 'Direct'}

### Engagement Metrics
- Page Views: ${pageViews.length}
- Total Clicks: ${clicks.length}
- Max Scroll Depth: ${session.maxScrollDepth ? Math.round(session.maxScrollDepth) + '%' : 'Unknown'}
- Form Interactions: ${formEvents.length}

### Frustration Signals
${frustrationEvents.length > 0 ? `
- Rage Clicks: ${frustrationEvents.filter((e) => e.eventType === 'rage_click').length}
- Dead Clicks: ${frustrationEvents.filter((e) => e.eventType === 'dead_click').length}
- Mouse Thrashing: ${frustrationEvents.filter((e) => e.eventType === 'mouse_thrash').length}
- Exit Intents: ${frustrationEvents.filter((e) => e.eventType === 'exit_intent').length}
` : 'No frustration signals detected'}

### Time Spent Per Page
${Object.entries(timePerPage)
  .sort((a, b) => b[1] - a[1])
  .map(([path, ms]) => `- ${path}: ${Math.round(ms / 1000)}s`)
  .join('\n') || 'No page time data'}

### Event Timeline (Key Events)
${eventTimeline || 'No events recorded'}

${site ? `
### Site Context
- Site Name: ${site.name}
- Domain: ${site.domain}
${site.businessType ? `- Business Type: ${site.businessType}` : ''}
${site.description ? `- Description: ${site.description}` : ''}
${site.targetAudience ? `- Target Audience: ${site.targetAudience}` : ''}
` : ''}
`;
}
