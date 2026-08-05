import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sites, sessions, events, personas } from '@/lib/schema';
import { eq, and, gte, lte, desc, count, avg, sql, or, gt, isNotNull } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');
    const period = searchParams.get('period') || '30d';
    if (!siteId) return NextResponse.json({ error: 'Site ID required' }, { status: 400 });

    const result = await db.query.personas.findFirst({
      where: and(eq(personas.siteId, siteId), eq(personas.period, period)),
      orderBy: [desc(personas.generatedAt)],
    });

    return NextResponse.json({ personas: result || null });
  } catch (error) {
    console.error('Personas GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch personas' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { siteId, period = '30d' } = await request.json();
    if (!siteId) return NextResponse.json({ error: 'Site ID required' }, { status: 400 });

    const now = new Date();
    const days = period === '90d' ? 90 : period === '30d' ? 30 : 7;
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Engaged session filter — excludes obvious bots (0 page views + null/tiny duration)
    const engagedFilter = and(
      eq(sessions.siteId, siteId),
      eq(sessions.isExcluded, false),
      gte(sessions.startedAt, start),
      lte(sessions.startedAt, now),
      or(gt(sessions.pageViews, 1), and(isNotNull(sessions.duration), gt(sessions.duration, 2000)))
    );

    const [
      site,
      overview,
      devices,
      countries,
      referrers,
      entryPages,
      exitPages,
      frictionByPage,
    ] = await Promise.all([
      db.query.sites.findFirst({ where: eq(sites.id, siteId) }),

      db.select({
        total: count(sessions.id),
        avgDuration: avg(sessions.duration),
        avgPageViews: avg(sessions.pageViews),
        avgScrollDepth: avg(sessions.maxScrollDepth),
      }).from(sessions).where(engagedFilter),

      db.select({ device: sessions.deviceType, n: count(sessions.id) })
        .from(sessions).where(engagedFilter)
        .groupBy(sessions.deviceType),

      db.select({ country: sessions.country, n: count(sessions.id) })
        .from(sessions).where(engagedFilter)
        .groupBy(sessions.country).orderBy(desc(count(sessions.id))).limit(5),

      db.select({ referrer: sessions.referrer, n: count(sessions.id) })
        .from(sessions).where(engagedFilter)
        .groupBy(sessions.referrer).orderBy(desc(count(sessions.id))).limit(8),

      db.select({ page: sessions.entryPage, n: count(sessions.id), avgDur: avg(sessions.duration) })
        .from(sessions).where(engagedFilter)
        .groupBy(sessions.entryPage).orderBy(desc(count(sessions.id))).limit(10),

      db.select({ page: sessions.exitPage, n: count(sessions.id) })
        .from(sessions).where(engagedFilter)
        .groupBy(sessions.exitPage).orderBy(desc(count(sessions.id))).limit(10),

      db.select({ path: events.path, n: count(events.id) })
        .from(events).where(and(
          eq(events.siteId, siteId),
          eq(events.isExcluded, false),
          gte(events.timestamp, start),
          lte(events.timestamp, now),
          sql`${events.eventType} IN ('rage_click', 'dead_click', 'form_abandonment', 'exit_intent')`
        )).groupBy(events.path).orderBy(desc(count(events.id))).limit(8),
    ]);

    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

    const depthBuckets = await db.execute(sql`
      SELECT
        CASE
          WHEN page_views <= 1 THEN '1 page'
          WHEN page_views BETWEEN 2 AND 4 THEN '2-4 pages'
          ELSE '5+ pages'
        END AS bucket,
        COUNT(*) AS count,
        ROUND(AVG(duration) / 1000)::int AS avg_seconds,
        ROUND(AVG(max_scroll_depth))::int AS avg_scroll
      FROM sessions
      WHERE site_id = ${siteId}
        AND is_excluded = false
        AND started_at >= ${start}
        AND started_at <= ${now}
        AND (page_views > 1 OR (duration IS NOT NULL AND duration > 2000))
      GROUP BY bucket
      ORDER BY count DESC
    `);

    const totalEngaged = Number(overview[0].total) || 0;
    if (totalEngaged < 3) {
      return NextResponse.json({ error: 'Not enough session data to generate personas' }, { status: 422 });
    }

    const prompt = buildPrompt({
      site,
      period,
      overview: {
        total: totalEngaged,
        avgDurationSeconds: Math.round(Number(overview[0].avgDuration) / 1000) || 0,
        avgPageViews: Math.round((Number(overview[0].avgPageViews) || 0) * 10) / 10,
        avgScrollDepth: Math.round(Number(overview[0].avgScrollDepth) || 0),
      },
      devices,
      countries,
      referrers,
      entryPages,
      exitPages,
      depthBuckets: depthBuckets as unknown as { bucket: string; count: number; avg_seconds: number; avg_scroll: number }[],
      frictionByPage,
    });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response type');

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Could not parse persona data from response');

    const personaData = JSON.parse(jsonMatch[0]);

    await db.delete(personas).where(and(eq(personas.siteId, siteId), eq(personas.period, period)));
    const [newRecord] = await db.insert(personas).values({
      siteId,
      period,
      data: personaData,
    }).returning();

    return NextResponse.json({ personas: newRecord });
  } catch (error) {
    console.error('Personas POST error:', error);
    return NextResponse.json({ error: 'Failed to generate personas' }, { status: 500 });
  }
}

function buildPrompt(data: {
  site: { name: string; domain: string; siteCategory: string | null; businessType: string | null; targetAudience: string | null };
  period: string;
  overview: { total: number; avgDurationSeconds: number; avgPageViews: number; avgScrollDepth: number };
  devices: { device: string | null; n: number }[];
  countries: { country: string | null; n: number }[];
  referrers: { referrer: string | null; n: number }[];
  entryPages: { page: string | null; n: number; avgDur: number | null }[];
  exitPages: { page: string | null; n: number }[];
  depthBuckets: { bucket: string; count: number; avg_seconds: number; avg_scroll: number }[];
  frictionByPage: { path: string; n: number }[];
}) {
  const periodLabel = data.period === '90d' ? '90 days' : data.period === '30d' ? '30 days' : '7 days';
  const ov = data.overview;

  const deviceTotal = data.devices.reduce((s, d) => s + d.n, 0) || 1;
  const deviceStr = data.devices
    .map(d => `${d.device || 'unknown'}: ${Math.round((d.n / deviceTotal) * 100)}%`)
    .join(', ');

  return `You are a senior UX researcher. Analyze this website analytics data and create 2–4 distinct user personas.

Base each persona on observable behavioral patterns in the data — not demographic guesses. Each persona should represent a real cluster: how they enter, what they do, how long they stay, what frustrates them.

SITE: ${data.site.name} (${data.site.domain})
TYPE: ${data.site.siteCategory || 'unknown'} — ${data.site.businessType || 'unknown'}
TARGET AUDIENCE: ${data.site.targetAudience || 'not specified'}

ENGAGED SESSIONS (last ${periodLabel}, bots excluded):
Total: ${ov.total} | Avg duration: ${ov.avgDurationSeconds}s | Avg pages/session: ${ov.avgPageViews} | Avg scroll depth: ${ov.avgScrollDepth}%

DEVICE BREAKDOWN:
${deviceStr}

TOP COUNTRIES:
${data.countries.map(c => `  ${c.country || 'Unknown'}: ${c.n} sessions`).join('\n')}

TRAFFIC SOURCES:
${data.referrers.map(r => `  ${r.referrer || 'Direct/Unknown'}: ${r.n} sessions`).join('\n')}

SESSION DEPTH DISTRIBUTION:
${data.depthBuckets.map(b => `  ${b.bucket}: ${b.count} sessions (avg ${b.avg_seconds}s, avg ${b.avg_scroll}% scroll)`).join('\n')}

ENTRY PAGES:
${data.entryPages.map(p => `  ${p.page || '/'}: ${p.n} sessions (avg ${Math.round(Number(p.avgDur) / 1000) || 0}s)`).join('\n')}

EXIT PAGES:
${data.exitPages.map(p => `  ${p.page || '/'}: ${p.n} exits`).join('\n')}

TOP FRICTION PAGES (rage clicks, dead clicks, exit intent, form abandonment):
${data.frictionByPage.length > 0 ? data.frictionByPage.map(p => `  ${p.path}: ${p.n} friction events`).join('\n') : '  None recorded'}

Create 2–4 personas that reflect distinct behavioral clusters visible in this data. If the data only supports 2 distinct clusters, return 2. Give each persona a memorable name and a realistic archetype label.

Return ONLY valid JSON:
{
  "personas": [
    {
      "id": "persona_1",
      "name": "Short memorable name (2-3 words)",
      "archetype": "Role or type label (e.g. Potential Client, Casual Browser, Serious Evaluator)",
      "tagline": "One sentence describing their core goal on this site",
      "emoji": "Single emoji representing this persona",
      "prevalence": <integer 0-100, estimated % of engaged sessions>,
      "primaryDevice": "desktop|mobile|mixed",
      "topLocations": ["Country 1", "Country 2"],
      "primarySource": "Direct|Search|Social|Referral",
      "avgDurationSeconds": <integer>,
      "avgPageViews": <number with one decimal>,
      "typicalEntryPage": "/path",
      "typicalExitPage": "/path",
      "goals": ["Goal 1", "Goal 2"],
      "behaviors": ["Specific observable behavior 1", "Specific observable behavior 2", "Specific observable behavior 3"],
      "frustrations": ["Specific frustration 1", "Specific frustration 2"],
      "motivations": "1-2 sentences on what drives them to this site and what they hope to find",
      "quote": "A realistic first-person quote from this persona's perspective (1-2 sentences)"
    }
  ],
  "summary": "2-3 sentences describing the overall audience composition and what it means for the site."
}`;
}
