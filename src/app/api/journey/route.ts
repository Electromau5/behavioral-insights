import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sites, sessions, events, journeyMaps } from '@/lib/schema';
import { eq, and, gte, lte, desc, count, avg, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');
    const period = searchParams.get('period') || '7d';

    if (!siteId) {
      return NextResponse.json({ error: 'Site ID is required' }, { status: 400 });
    }

    const map = await db.query.journeyMaps.findFirst({
      where: and(eq(journeyMaps.siteId, siteId), eq(journeyMaps.period, period)),
      orderBy: [desc(journeyMaps.generatedAt)],
    });

    return NextResponse.json({ map: map || null });
  } catch (error) {
    console.error('Journey GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch journey map' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { siteId, period = '7d' } = await request.json();
    if (!siteId) {
      return NextResponse.json({ error: 'Site ID is required' }, { status: 400 });
    }

    const now = new Date();
    const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Gather all analytics data in parallel
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

      db.select({
        page: sessions.entryPage,
        count: count(sessions.id),
      }).from(sessions).where(and(
        eq(sessions.siteId, siteId),
        eq(sessions.isExcluded, false),
        gte(sessions.startedAt, start),
        lte(sessions.startedAt, now)
      )).groupBy(sessions.entryPage).orderBy(desc(count(sessions.id))).limit(15),

      db.select({
        page: sessions.exitPage,
        count: count(sessions.id),
      }).from(sessions).where(and(
        eq(sessions.siteId, siteId),
        eq(sessions.isExcluded, false),
        gte(sessions.startedAt, start),
        lte(sessions.startedAt, now)
      )).groupBy(sessions.exitPage).orderBy(desc(count(sessions.id))).limit(15),

      db.select({
        path: events.path,
        views: count(events.id),
      }).from(events).where(and(
        eq(events.siteId, siteId),
        eq(events.isExcluded, false),
        eq(events.eventType, 'pageview'),
        gte(events.timestamp, start),
        lte(events.timestamp, now)
      )).groupBy(events.path).orderBy(desc(count(events.id))).limit(20),

      db.select({
        referrer: sessions.referrer,
        count: count(sessions.id),
      }).from(sessions).where(and(
        eq(sessions.siteId, siteId),
        eq(sessions.isExcluded, false),
        gte(sessions.startedAt, start),
        lte(sessions.startedAt, now)
      )).groupBy(sessions.referrer).orderBy(desc(count(sessions.id))).limit(10),

      db.select({
        path: events.path,
        frictionCount: count(events.id),
      }).from(events).where(and(
        eq(events.siteId, siteId),
        eq(events.isExcluded, false),
        gte(events.timestamp, start),
        lte(events.timestamp, now),
        sql`${events.eventType} IN ('rage_click', 'dead_click', 'form_abandonment', 'exit_intent')`
      )).groupBy(events.path).orderBy(desc(count(events.id))).limit(10),
    ]);

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Page transitions via window function
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

    const overview = sessionOverview[0];
    const totalSessions = Number(overview.total) || 0;
    const bounceRate = totalSessions > 0
      ? Math.round((Number(overview.bounceCount) / totalSessions) * 100)
      : 0;

    if (totalSessions === 0) {
      return NextResponse.json({ error: 'No session data available for this period' }, { status: 422 });
    }

    const prompt = buildPrompt({
      site,
      period,
      overview: {
        totalSessions,
        avgDuration: Math.round(Number(overview.avgDuration) / 1000) || 0,
        avgPageViews: Math.round((Number(overview.avgPageViews) || 0) * 10) / 10,
        avgScrollDepth: Math.round(Number(overview.avgScrollDepth) || 0),
        bounceRate,
      },
      entryPages,
      exitPages,
      topPages,
      transitions: transitionRows as unknown as { from_page: string; to_page: string; transitions: number }[],
      referrers,
      frictionByPage,
    });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse journey map from Claude response');
    }

    const journeyData = JSON.parse(jsonMatch[0]);

    // Delete existing map for this site+period and insert fresh one
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

    return NextResponse.json({ map: newMap });
  } catch (error) {
    console.error('Journey POST error:', error);
    return NextResponse.json({ error: 'Failed to generate journey map' }, { status: 500 });
  }
}

function buildPrompt(data: {
  site: { name: string; domain: string; siteCategory: string | null; businessType: string | null; targetAudience: string | null };
  period: string;
  overview: { totalSessions: number; avgDuration: number; avgPageViews: number; avgScrollDepth: number; bounceRate: number };
  entryPages: { page: string | null; count: number }[];
  exitPages: { page: string | null; count: number }[];
  topPages: { path: string; views: number }[];
  transitions: { from_page: string; to_page: string; transitions: number }[];
  referrers: { referrer: string | null; count: number }[];
  frictionByPage: { path: string; frictionCount: number }[];
}) {
  const periodLabel = data.period === '30d' ? '30 days' : data.period === '90d' ? '90 days' : '7 days';

  return `You are a senior UX researcher. Analyze this website analytics data and create a customer journey map.

SITE: ${data.site.name} (${data.site.domain})
TYPE: ${data.site.siteCategory || 'unknown'} — ${data.site.businessType || 'unknown'}
TARGET AUDIENCE: ${data.site.targetAudience || 'not specified'}

ANALYTICS (last ${periodLabel}):
Sessions: ${data.overview.totalSessions} | Avg duration: ${data.overview.avgDuration}s | Avg pages/session: ${data.overview.avgPageViews} | Bounce rate: ${data.overview.bounceRate}% | Avg scroll depth: ${data.overview.avgScrollDepth}%

ENTRY POINTS:
${data.entryPages.slice(0, 10).map(p => `  ${p.page || '/'}: ${p.count} sessions`).join('\n')}

TOP PAGES BY VIEWS:
${data.topPages.slice(0, 15).map(p => `  ${p.path}: ${p.views} views`).join('\n')}

COMMON PAGE TRANSITIONS:
${data.transitions.slice(0, 15).map(t => `  ${t.from_page} → ${t.to_page}: ${t.transitions}x`).join('\n')}

EXIT POINTS:
${data.exitPages.slice(0, 10).map(p => `  ${p.page || '/'}: ${p.count} exits`).join('\n')}

TRAFFIC SOURCES:
${data.referrers.slice(0, 8).map(r => `  ${r.referrer || 'Direct/Unknown'}: ${r.count}`).join('\n')}

FRICTION PAGES (rage clicks, dead clicks, form abandonment, exit intent):
${data.frictionByPage.slice(0, 8).map(p => `  ${p.path}: ${p.frictionCount} friction events`).join('\n')}

Create a journey map with 3–6 stages that reflect actual navigation patterns. Base stage names on what users are doing on this specific site, not generic marketing funnel labels.

Return ONLY valid JSON (no markdown, no explanation):
{
  "stages": [
    {
      "id": "stage_1",
      "name": "Stage name (2-3 words)",
      "description": "1-2 sentences describing what happens at this stage",
      "emotion": "curious|excited|engaged|uncertain|frustrated|satisfied|confused|hopeful",
      "emotionScore": <integer 0-10>,
      "touchpoints": ["page/path"],
      "userActions": ["Specific action 1", "Specific action 2"],
      "userThoughts": ["What are they thinking?"],
      "painPoints": ["Pain point if any"],
      "opportunities": ["Specific improvement"],
      "metrics": {
        "sessionsReaching": <integer>,
        "avgTimeSeconds": <integer>,
        "dropOffRate": <integer 0-100>
      },
      "frictionLevel": "none|low|medium|high"
    }
  ],
  "overallNarrative": "2-3 sentences describing the typical journey",
  "criticalMoment": "The single most important moment in the journey and why",
  "biggestDropOff": {
    "location": "Where the drop-off occurs",
    "rate": <integer>,
    "reason": "Why users leave here",
    "fix": "One specific recommendation"
  },
  "topOpportunity": "The single biggest opportunity to improve this journey",
  "journeyHealthScore": <integer 0-100>
}`;
}
