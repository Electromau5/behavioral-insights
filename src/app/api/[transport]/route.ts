import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { timingSafeEqual } from 'crypto';
import { db } from '@/lib/db';
import { sites, sessions, events, insights, userFlows, journeyMaps } from '@/lib/schema';
import { eq, and, gte, lte, desc, sql, count, avg, countDistinct } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

const periodSchema = z.enum(['7d', '30d', '90d']).default('7d');

function periodStart(period: '7d' | '30d' | '90d'): Date {
  const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function json(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

const handler = createMcpHandler(
  (server) => {
    server.tool(
      'list_sites',
      'List all sites being tracked, including their business context used for AI analysis. Returns site IDs needed by every other tool.',
      {},
      async () => {
        const rows = await db
          .select({
            id: sites.id,
            name: sites.name,
            domain: sites.domain,
            isActive: sites.isActive,
            businessType: sites.businessType,
            description: sites.description,
            targetAudience: sites.targetAudience,
            primaryGoals: sites.primaryGoals,
            createdAt: sites.createdAt,
          })
          .from(sites)
          .orderBy(desc(sites.createdAt));
        return json(rows);
      }
    );

    server.tool(
      'get_metrics',
      'Get overview metrics for a site: total sessions, unique visitors, page views, avg session duration (seconds), avg scroll depth, bounce rate, top pages, and device breakdown. Traffic from excluded IPs is omitted unless includeExcluded is true.',
      { siteId: z.string().uuid(), period: periodSchema, includeExcluded: z.boolean().default(false) },
      async ({ siteId, period, includeExcluded }) => {
        const now = new Date();
        const start = periodStart(period);
        const range = and(
          eq(sessions.siteId, siteId),
          gte(sessions.startedAt, start),
          lte(sessions.startedAt, now),
          ...(includeExcluded ? [] : [eq(sessions.isExcluded, false)])
        );

        const [overview] = await db
          .select({
            totalSessions: count(sessions.id),
            uniqueVisitors: countDistinct(sessions.visitorId),
            totalPageViews: sql<number>`COALESCE(SUM(${sessions.pageViews}), 0)`,
            avgSessionDuration: avg(sessions.duration),
            avgScrollDepth: avg(sessions.maxScrollDepth),
            bounceCount: sql<number>`COUNT(CASE WHEN ${sessions.isBounce} = true THEN 1 END)`,
          })
          .from(sessions)
          .where(range);

        const topPages = await db
          .select({ path: sessions.entryPage, views: count(sessions.id), avgDuration: avg(sessions.duration) })
          .from(sessions)
          .where(range)
          .groupBy(sessions.entryPage)
          .orderBy(sql`count(*) DESC`)
          .limit(10);

        const deviceBreakdown = await db
          .select({ device: sessions.deviceType, count: count(sessions.id) })
          .from(sessions)
          .where(range)
          .groupBy(sessions.deviceType);

        const bounceRate = overview.totalSessions > 0 ? (overview.bounceCount / overview.totalSessions) * 100 : 0;

        return json({
          period,
          overview: {
            totalSessions: Number(overview.totalSessions),
            uniqueVisitors: Number(overview.uniqueVisitors),
            totalPageViews: Number(overview.totalPageViews),
            avgSessionDuration: Math.round(Number(overview.avgSessionDuration) / 1000) || 0,
            avgScrollDepth: Math.round(Number(overview.avgScrollDepth)) || 0,
            bounceRate: Math.round(bounceRate * 10) / 10,
          },
          topPages,
          deviceBreakdown,
        });
      }
    );

    server.tool(
      'list_sessions',
      'List visitor sessions for a site, sortable by recency, clicks, duration, or page views. Use get_session for the full event timeline of one session.',
      {
        siteId: z.string().uuid(),
        period: periodSchema,
        sortBy: z.enum(['recent', 'clicks', 'duration', 'pageViews']).default('recent'),
        limit: z.number().int().min(1).max(100).default(25),
        includeExcluded: z.boolean().default(false),
      },
      async ({ siteId, period, sortBy, limit, includeExcluded }) => {
        const orderCol =
          sortBy === 'clicks' ? desc(sessions.clicks)
          : sortBy === 'duration' ? desc(sessions.duration)
          : sortBy === 'pageViews' ? desc(sessions.pageViews)
          : desc(sessions.startedAt);

        const rows = await db
          .select()
          .from(sessions)
          .where(and(
            eq(sessions.siteId, siteId),
            gte(sessions.startedAt, periodStart(period)),
            ...(includeExcluded ? [] : [eq(sessions.isExcluded, false)])
          ))
          .orderBy(orderCol)
          .limit(limit);
        return json(rows);
      }
    );

    server.tool(
      'get_session',
      'Get one session with its full chronological event timeline (page views, clicks, friction events, form interactions).',
      { sessionId: z.string(), eventLimit: z.number().int().min(1).max(500).default(200) },
      async ({ sessionId, eventLimit }) => {
        const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
        if (!session) return json({ error: `No session found with id ${sessionId}` });

        const timeline = await db
          .select({
            eventType: events.eventType,
            timestamp: events.timestamp,
            path: events.path,
            eventData: events.eventData,
          })
          .from(events)
          .where(eq(events.sessionId, sessionId))
          .orderBy(events.timestamp)
          .limit(eventLimit);

        return json({ session, events: timeline });
      }
    );

    server.tool(
      'get_friction_summary',
      'Summarize UX friction for a site: rage clicks, dead clicks, mouse thrashes, form abandonments, field skips, and exit intents — totals and per-page breakdown.',
      { siteId: z.string().uuid(), period: periodSchema, includeExcluded: z.boolean().default(false) },
      async ({ siteId, period, includeExcluded }) => {
        const frictionTypes = ['rage_click', 'dead_click', 'mouse_thrash', 'form_abandonment', 'form_field_skip', 'exit_intent'];
        const range = and(
          eq(events.siteId, siteId),
          gte(events.timestamp, periodStart(period)),
          sql`${events.eventType} IN ('rage_click', 'dead_click', 'mouse_thrash', 'form_abandonment', 'form_field_skip', 'exit_intent')`,
          ...(includeExcluded ? [] : [eq(events.isExcluded, false)])
        );

        const byType = await db
          .select({ eventType: events.eventType, count: count(events.id) })
          .from(events)
          .where(range)
          .groupBy(events.eventType);

        const byPage = await db
          .select({
            path: events.path,
            eventType: events.eventType,
            count: count(events.id),
            sessions: countDistinct(events.sessionId),
          })
          .from(events)
          .where(range)
          .groupBy(events.path, events.eventType)
          .orderBy(sql`count(*) DESC`)
          .limit(50);

        const totals = Object.fromEntries(frictionTypes.map((t) => [t, 0]));
        for (const row of byType) totals[row.eventType] = Number(row.count);

        return json({ period, totals, byPage });
      }
    );

    server.tool(
      'list_insights',
      'List AI-generated insights for a site (anomalies, trends, warnings), newest first.',
      {
        siteId: z.string().uuid(),
        includeDismissed: z.boolean().default(false),
        limit: z.number().int().min(1).max(100).default(25),
      },
      async ({ siteId, includeDismissed, limit }) => {
        const where = includeDismissed
          ? eq(insights.siteId, siteId)
          : and(eq(insights.siteId, siteId), eq(insights.isDismissed, false));
        const rows = await db.select().from(insights).where(where).orderBy(desc(insights.createdAt)).limit(limit);
        return json(rows);
      }
    );

    server.tool(
      'get_journey_map',
      'Retrieve the most recently generated customer journey map for a site and period. Returns null if none has been generated yet.',
      { siteId: z.string().uuid(), period: periodSchema },
      async ({ siteId, period }) => {
        const map = await db.query.journeyMaps.findFirst({
          where: and(eq(journeyMaps.siteId, siteId), eq(journeyMaps.period, period)),
          orderBy: [desc(journeyMaps.generatedAt)],
        });
        return json(map ?? null);
      }
    );

    server.tool(
      'generate_journey_map',
      'Generate (or regenerate) an AI-powered customer journey map for a site by analyzing session data, page transitions, entry/exit patterns, and friction events. Stores the result and returns it. Takes 10–20 seconds.',
      { siteId: z.string().uuid(), period: periodSchema },
      async ({ siteId, period }) => {
        const now = new Date();
        const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
        const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

        const [
          site,
          sessionOverview,
          entryPages,
          exitPages,
          topPages,
          referrers,
          frictionByPage,
        ] = await Promise.all([
          db.query.sites.findFirst({ where: eq(sites.id, siteId) }),

          db.select({
            total: count(sessions.id),
            avgDuration: avg(sessions.duration),
            avgPageViews: avg(sessions.pageViews),
            avgScrollDepth: avg(sessions.maxScrollDepth),
            bounceCount: sql<number>`sum(case when ${sessions.isBounce} = true then 1 else 0 end)`,
          }).from(sessions).where(and(
            eq(sessions.siteId, siteId),
            eq(sessions.isExcluded, false),
            gte(sessions.startedAt, start),
            lte(sessions.startedAt, now)
          )),

          db.select({ page: sessions.entryPage, count: count(sessions.id) })
            .from(sessions)
            .where(and(eq(sessions.siteId, siteId), eq(sessions.isExcluded, false), gte(sessions.startedAt, start), lte(sessions.startedAt, now)))
            .groupBy(sessions.entryPage).orderBy(desc(count(sessions.id))).limit(15),

          db.select({ page: sessions.exitPage, count: count(sessions.id) })
            .from(sessions)
            .where(and(eq(sessions.siteId, siteId), eq(sessions.isExcluded, false), gte(sessions.startedAt, start), lte(sessions.startedAt, now)))
            .groupBy(sessions.exitPage).orderBy(desc(count(sessions.id))).limit(15),

          db.select({ path: events.path, views: count(events.id) })
            .from(events)
            .where(and(eq(events.siteId, siteId), eq(events.isExcluded, false), eq(events.eventType, 'pageview'), gte(events.timestamp, start), lte(events.timestamp, now)))
            .groupBy(events.path).orderBy(desc(count(events.id))).limit(20),

          db.select({ referrer: sessions.referrer, count: count(sessions.id) })
            .from(sessions)
            .where(and(eq(sessions.siteId, siteId), eq(sessions.isExcluded, false), gte(sessions.startedAt, start), lte(sessions.startedAt, now)))
            .groupBy(sessions.referrer).orderBy(desc(count(sessions.id))).limit(10),

          db.select({ path: events.path, frictionCount: count(events.id) })
            .from(events)
            .where(and(
              eq(events.siteId, siteId),
              eq(events.isExcluded, false),
              gte(events.timestamp, start),
              lte(events.timestamp, now),
              sql`${events.eventType} IN ('rage_click','dead_click','form_abandonment','exit_intent')`
            ))
            .groupBy(events.path).orderBy(desc(count(events.id))).limit(10),
        ]);

        if (!site) return json({ error: 'Site not found' });

        const ov = sessionOverview[0];
        const totalSessions = Number(ov.total) || 0;
        if (totalSessions === 0) return json({ error: 'No session data available for this period' });

        const transitionRows = await db.execute(sql`
          WITH ordered_views AS (
            SELECT session_id, path, timestamp,
              ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY timestamp) AS rn
            FROM events
            WHERE site_id = ${siteId}
              AND event_type = 'pageview'
              AND is_excluded = false
              AND timestamp >= ${start}
              AND timestamp <= ${now}
          )
          SELECT r1.path AS from_page, r2.path AS to_page, COUNT(*) AS transitions
          FROM ordered_views r1
          JOIN ordered_views r2 ON r1.session_id = r2.session_id AND r2.rn = r1.rn + 1
          GROUP BY r1.path, r2.path
          ORDER BY transitions DESC
          LIMIT 20
        `);

        const bounceRate = totalSessions > 0
          ? Math.round((Number(ov.bounceCount) / totalSessions) * 100) : 0;

        const periodLabel = period === '30d' ? '30 days' : period === '90d' ? '90 days' : '7 days';

        const prompt = `You are a senior UX researcher. Analyze this website analytics data and create a customer journey map.

SITE: ${site.name} (${site.domain})
TYPE: ${site.siteCategory || 'unknown'} — ${site.businessType || 'unknown'}
TARGET AUDIENCE: ${site.targetAudience || 'not specified'}

ANALYTICS (last ${periodLabel}):
Sessions: ${totalSessions} | Avg duration: ${Math.round(Number(ov.avgDuration) / 1000) || 0}s | Avg pages/session: ${Math.round((Number(ov.avgPageViews) || 0) * 10) / 10} | Bounce rate: ${bounceRate}% | Avg scroll depth: ${Math.round(Number(ov.avgScrollDepth) || 0)}%

ENTRY POINTS:
${entryPages.slice(0, 10).map(p => `  ${p.page || '/'}: ${p.count} sessions`).join('\n')}

TOP PAGES BY VIEWS:
${topPages.slice(0, 15).map(p => `  ${p.path}: ${p.views} views`).join('\n')}

COMMON PAGE TRANSITIONS:
${(transitionRows as unknown as { from_page: string; to_page: string; transitions: number }[]).slice(0, 15).map(t => `  ${t.from_page} → ${t.to_page}: ${t.transitions}x`).join('\n')}

EXIT POINTS:
${exitPages.slice(0, 10).map(p => `  ${p.page || '/'}: ${p.count} exits`).join('\n')}

TRAFFIC SOURCES:
${referrers.slice(0, 8).map(r => `  ${r.referrer || 'Direct/Unknown'}: ${r.count}`).join('\n')}

FRICTION PAGES:
${frictionByPage.slice(0, 8).map(p => `  ${p.path}: ${p.frictionCount} friction events`).join('\n')}

Create a journey map with 3–6 stages that reflect actual navigation patterns. Base stage names on what users are doing on this specific site.

Return ONLY valid JSON:
{
  "stages": [
    {
      "id": "stage_1",
      "name": "Stage name (2-3 words)",
      "description": "1-2 sentences",
      "emotion": "curious|excited|engaged|uncertain|frustrated|satisfied|confused|hopeful",
      "emotionScore": <0-10>,
      "touchpoints": ["page/path"],
      "userActions": ["Action 1", "Action 2"],
      "userThoughts": ["What are they thinking?"],
      "painPoints": ["Pain point if any"],
      "opportunities": ["Improvement"],
      "metrics": { "sessionsReaching": <int>, "avgTimeSeconds": <int>, "dropOffRate": <0-100> },
      "frictionLevel": "none|low|medium|high"
    }
  ],
  "overallNarrative": "2-3 sentences",
  "criticalMoment": "The single most important moment",
  "biggestDropOff": { "location": "Where", "rate": <int>, "reason": "Why", "fix": "One fix" },
  "topOpportunity": "Biggest opportunity",
  "journeyHealthScore": <0-100>
}`;

        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }],
        });

        const text = response.content[0].type === 'text' ? response.content[0].text : '';
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) return json({ error: 'Could not parse journey map from AI response' });

        const journeyData = JSON.parse(match[0]);

        await db.delete(journeyMaps).where(
          and(eq(journeyMaps.siteId, siteId), eq(journeyMaps.period, period))
        );
        const [newMap] = await db.insert(journeyMaps).values({
          siteId,
          period,
          stages: journeyData.stages,
          summary: {
            overallNarrative: journeyData.overallNarrative,
            criticalMoment: journeyData.criticalMoment,
            biggestDropOff: journeyData.biggestDropOff,
            topOpportunity: journeyData.topOpportunity,
            journeyHealthScore: journeyData.journeyHealthScore,
          },
        }).returning();

        return json(newMap);
      }
    );

    server.tool(
      'list_flows',
      'List user flows for a site: the page-by-page path each visitor took, with duration, clicks, device, and country.',
      {
        siteId: z.string().uuid(),
        period: periodSchema,
        limit: z.number().int().min(1).max(100).default(25),
      },
      async ({ siteId, period, limit }) => {
        const rows = await db
          .select()
          .from(userFlows)
          .where(and(eq(userFlows.siteId, siteId), gte(userFlows.startedAt, periodStart(period))))
          .orderBy(desc(userFlows.startedAt))
          .limit(limit);
        return json(rows);
      }
    );
  },
  {
    serverInfo: { name: 'behavioral-insights', version: '1.0.0' },
  },
  {
    basePath: '/api',
    verboseLogs: false,
    disableSse: true,
  }
);

function isAuthorized(request: Request): boolean {
  const secret = process.env.MCP_API_KEY;
  if (!secret) return false;
  const header = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function withAuth(next: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    if (!isAuthorized(request)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return next(request);
  };
}

export const GET = withAuth(handler);
export const POST = withAuth(handler);
export const DELETE = withAuth(handler);
