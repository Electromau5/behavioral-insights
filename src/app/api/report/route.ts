import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sites, sessions, events, personas, journeyMaps } from '@/lib/schema';
import { eq, and, gte, lte, desc, count, avg, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PersonaItem {
  id: string; name: string; archetype: string; tagline: string; emoji: string;
  prevalence: number; primaryDevice: string; topLocations: string[];
  primarySource: string; avgDurationSeconds: number; avgPageViews: number;
  typicalEntryPage: string; typicalExitPage: string;
  goals: string[]; behaviors: string[]; frustrations: string[];
  motivations: string; quote: string;
}
interface PersonaData { personas: PersonaItem[]; summary: string; }

interface JourneyStage {
  id: string; name: string; description: string; emotion: string;
  emotionScore: number; touchpoints: string[]; userActions: string[];
  userThoughts: string[]; painPoints: string[]; opportunities: string[];
  metrics: { sessionsReaching: number; avgTimeSeconds: number; dropOffRate: number };
  frictionLevel: string;
}
interface JourneySummary {
  overallNarrative: string; criticalMoment: string;
  biggestDropOff: { location: string; rate: number; reason: string; fix: string };
  topOpportunity: string; journeyHealthScore: number;
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');
    const period = searchParams.get('period') || '30d';
    if (!siteId) return NextResponse.json({ error: 'Site ID required' }, { status: 400 });

    const days = period === '90d' ? 90 : period === '30d' ? 30 : 7;
    const now = new Date();
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const baseFilter = and(
      eq(sessions.siteId, siteId),
      eq(sessions.isExcluded, false),
      gte(sessions.startedAt, start),
      lte(sessions.startedAt, now)
    );

    const eventFilter = and(
      eq(events.siteId, siteId),
      eq(events.isExcluded, false),
      gte(events.timestamp, start),
      lte(events.timestamp, now)
    );

    const [
      site,
      overviewRows,
      devices,
      countries,
      referrers,
      topPages,
      entryPages,
      exitPages,
      frictionByType,
      frictionByPage,
      personasRecord,
      journeyRecord,
    ] = await Promise.all([
      db.query.sites.findFirst({ where: eq(sites.id, siteId) }),

      db.select({
        total: count(sessions.id),
        avgDuration: avg(sessions.duration),
        avgPageViews: avg(sessions.pageViews),
        avgScrollDepth: avg(sessions.maxScrollDepth),
        bounceCount: sql<number>`SUM(CASE WHEN ${sessions.isBounce} THEN 1 ELSE 0 END)`,
        totalPageViews: sql<number>`SUM(${sessions.pageViews})`,
      }).from(sessions).where(baseFilter),

      db.select({ device: sessions.deviceType, n: count(sessions.id) })
        .from(sessions).where(baseFilter)
        .groupBy(sessions.deviceType).orderBy(desc(count(sessions.id))),

      db.select({ country: sessions.country, n: count(sessions.id) })
        .from(sessions).where(baseFilter)
        .groupBy(sessions.country).orderBy(desc(count(sessions.id))).limit(8),

      db.select({ referrer: sessions.referrer, n: count(sessions.id) })
        .from(sessions).where(baseFilter)
        .groupBy(sessions.referrer).orderBy(desc(count(sessions.id))).limit(10),

      db.select({ path: events.path, views: count(events.id) })
        .from(events).where(and(eventFilter, eq(events.eventType, 'pageview')))
        .groupBy(events.path).orderBy(desc(count(events.id))).limit(15),

      db.select({ page: sessions.entryPage, n: count(sessions.id) })
        .from(sessions).where(baseFilter)
        .groupBy(sessions.entryPage).orderBy(desc(count(sessions.id))).limit(10),

      db.select({ page: sessions.exitPage, n: count(sessions.id) })
        .from(sessions).where(baseFilter)
        .groupBy(sessions.exitPage).orderBy(desc(count(sessions.id))).limit(10),

      db.select({ eventType: events.eventType, n: count(events.id) })
        .from(events).where(and(
          eventFilter,
          sql`${events.eventType} IN ('rage_click','dead_click','form_abandonment','exit_intent','mouse_thrash')`
        )).groupBy(events.eventType),

      db.select({ path: events.path, eventType: events.eventType, n: count(events.id) })
        .from(events).where(and(
          eventFilter,
          sql`${events.eventType} IN ('rage_click','dead_click','form_abandonment','exit_intent','mouse_thrash')`
        )).groupBy(events.path, events.eventType).orderBy(desc(count(events.id))).limit(20),

      db.query.personas.findFirst({
        where: and(eq(personas.siteId, siteId), eq(personas.period, period)),
        orderBy: [desc(personas.generatedAt)],
      }),

      db.query.journeyMaps.findFirst({
        where: and(eq(journeyMaps.siteId, siteId), eq(journeyMaps.period, period)),
        orderBy: [desc(journeyMaps.generatedAt)],
      }),
    ]);

    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

    const depthBuckets = await db.execute(sql`
      SELECT
        CASE
          WHEN page_views <= 1 THEN '1 page'
          WHEN page_views <= 4 THEN '2-4 pages'
          ELSE '5+ pages'
        END AS bucket,
        COUNT(*) AS n,
        ROUND(COALESCE(AVG(duration), 0) / 1000) AS avg_seconds
      FROM sessions
      WHERE site_id = ${siteId}
        AND is_excluded = false
        AND started_at >= ${start}
        AND started_at <= ${now}
      GROUP BY 1
      ORDER BY 1
    `) as unknown as { bucket: string; n: number; avg_seconds: number }[];

    const ov = overviewRows[0];
    const totalSessions = Number(ov.total) || 0;
    const bounceRate = totalSessions > 0
      ? Math.round((Number(ov.bounceCount) / totalSessions) * 100)
      : 0;

    const markdown = buildMarkdown({
      site,
      period,
      periodLabel: period === '90d' ? '90 days' : period === '30d' ? '30 days' : '7 days',
      start,
      now,
      overview: {
        total: totalSessions,
        totalPageViews: Number(ov.totalPageViews) || 0,
        avgDurationMs: Number(ov.avgDuration) || 0,
        avgPageViews: Math.round((Number(ov.avgPageViews) || 0) * 10) / 10,
        avgScrollDepth: Math.round(Number(ov.avgScrollDepth) || 0),
        bounceRate,
      },
      devices,
      countries,
      referrers,
      topPages,
      entryPages,
      exitPages,
      frictionByType,
      frictionByPage,
      depthBuckets,
      personaData: personasRecord?.data as PersonaData | null,
      personasGeneratedAt: personasRecord?.generatedAt ?? null,
      stages: journeyRecord?.stages as JourneyStage[] | null,
      journeySummary: journeyRecord?.summary as JourneySummary | null,
      journeyGeneratedAt: journeyRecord?.generatedAt ?? null,
    });

    const filename = `report-${site.name.toLowerCase().replace(/\s+/g, '-')}-${period}-${now.toISOString().slice(0, 10)}.md`;

    return new NextResponse(markdown, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'x-filename': filename,
      },
    });
  } catch (error) {
    console.error('Report error:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMs(ms: number): string {
  if (!ms || ms <= 0) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function fmtSecs(s: number): string {
  if (!s || s <= 0) return '—';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

function healthEmoji(score: number): string {
  if (score >= 70) return '🟢';
  if (score >= 40) return '🟡';
  return '🔴';
}

function frictionLabel(type: string): string {
  const map: Record<string, string> = {
    rage_click: 'Rage clicks', dead_click: 'Dead clicks',
    mouse_thrash: 'Mouse thrash', exit_intent: 'Exit intent',
    form_abandonment: 'Form abandonment',
  };
  return map[type] || type;
}

function table(headers: string[], rows: (string | number)[][]): string {
  const h = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const r = rows.map(row => `| ${row.join(' | ')} |`).join('\n');
  return [h, sep, r].join('\n');
}

// ─── Markdown builder ─────────────────────────────────────────────────────────

interface ReportData {
  site: { name: string; domain: string; siteCategory: string | null; businessType: string | null; targetAudience: string | null; description: string | null };
  period: string; periodLabel: string; start: Date; now: Date;
  overview: { total: number; totalPageViews: number; avgDurationMs: number; avgPageViews: number; avgScrollDepth: number; bounceRate: number };
  devices: { device: string | null; n: number }[];
  countries: { country: string | null; n: number }[];
  referrers: { referrer: string | null; n: number }[];
  topPages: { path: string; views: number }[];
  entryPages: { page: string | null; n: number }[];
  exitPages: { page: string | null; n: number }[];
  frictionByType: { eventType: string; n: number }[];
  frictionByPage: { path: string; eventType: string; n: number }[];
  depthBuckets: { bucket: string; n: number; avg_seconds: number }[];
  personaData: PersonaData | null;
  personasGeneratedAt: Date | null;
  stages: JourneyStage[] | null;
  journeySummary: JourneySummary | null;
  journeyGeneratedAt: Date | null;
}

function buildMarkdown(d: ReportData): string {
  const parts: string[] = [];
  const { site, overview: ov, periodLabel } = d;
  const dateRange = `${d.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${d.now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  const generated = d.now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // ── Header ──
  parts.push(`# Site Analysis Report: ${site.name}

**Domain:** ${site.domain}
**Period:** Last ${periodLabel} (${dateRange})
**Generated:** ${generated}${site.siteCategory ? `\n**Type:** ${site.siteCategory}${site.businessType ? ` — ${site.businessType}` : ''}` : ''}${site.targetAudience ? `\n**Target Audience:** ${site.targetAudience}` : ''}${site.description ? `\n**Description:** ${site.description}` : ''}

> This report is intended to be used as context for AI-assisted UX analysis. It aggregates quantitative metrics, friction signals, behavioral patterns, AI-generated user personas, and customer journey data for ${site.name}.`);

  // ── Executive Summary ──
  const flags: string[] = [];
  if (ov.bounceRate > 70) flags.push(`**High bounce rate (${ov.bounceRate}%):** Most visitors leave without exploring beyond the first page.`);
  if (ov.avgScrollDepth < 30) flags.push(`**Low scroll depth (${ov.avgScrollDepth}%):** Visitors are not reading far into most pages — content or layout may not be pulling them down.`);
  const contactFriction = d.frictionByPage.filter(r => r.path?.includes('contact') && r.eventType === 'exit_intent').reduce((s, r) => s + Number(r.n), 0);
  if (contactFriction > 5) flags.push(`**Contact page friction:** ${contactFriction} exit intent events on the contact page suggest motivated visitors are still abandoning before reaching out.`);
  if (!d.personaData) flags.push('**Personas not generated:** User personas have not been generated for this period. Generate them in the app for richer context.');
  if (!d.stages) flags.push('**Journey map not generated:** A customer journey map has not been generated for this period. Generate it in the app for stage-by-stage analysis.');
  if (d.journeySummary?.journeyHealthScore !== undefined && d.journeySummary.journeyHealthScore < 50) {
    flags.push(`**Low journey health score (${d.journeySummary.journeyHealthScore}/100):** The overall customer journey has significant friction. See the journey map section for stage-by-stage details.`);
  }

  parts.push(`## Executive Summary

${flags.length > 0 ? flags.map(f => `- ${f}`).join('\n') : '- No critical issues flagged for this period.'}`);

  // ── Core Metrics ──
  parts.push(`## Core Metrics

${table(
    ['Metric', 'Value'],
    [
      ['Total Sessions', ov.total.toLocaleString()],
      ['Total Page Views', ov.totalPageViews.toLocaleString()],
      ['Avg Session Duration', fmtMs(ov.avgDurationMs)],
      ['Avg Pages per Session', ov.avgPageViews.toString()],
      ['Avg Scroll Depth', `${ov.avgScrollDepth}%`],
      ['Bounce Rate', `${ov.bounceRate}%`],
    ]
  )}`);

  // ── Audience ──
  const deviceTotal = d.devices.reduce((s, x) => s + x.n, 0) || 1;
  const countryTotal = d.countries.reduce((s, x) => s + x.n, 0) || 1;

  parts.push(`## Audience

### Device Breakdown

${table(
    ['Device', 'Sessions', 'Share'],
    d.devices.map(x => [x.device || 'Unknown', x.n, `${Math.round((x.n / deviceTotal) * 100)}%`])
  )}

### Top Countries

${table(
    ['Country', 'Sessions', 'Share'],
    d.countries.map(x => [x.country || 'Unknown', x.n, `${Math.round((x.n / countryTotal) * 100)}%`])
  )}

### Traffic Sources

${table(
    ['Source', 'Sessions'],
    d.referrers.map(x => [x.referrer || 'Direct / Unknown', x.n])
  )}`);

  // ── Content Performance ──
  parts.push(`## Content Performance

### Top Pages by Views

${table(
    ['Page', 'Views'],
    d.topPages.map(x => [x.path || '/', x.views])
  )}

### Entry Points

${table(
    ['Entry Page', 'Sessions'],
    d.entryPages.map(x => [x.page || '/', x.n])
  )}

### Exit Points

${table(
    ['Exit Page', 'Sessions'],
    d.exitPages.map(x => [x.page || '/', x.n])
  )}`);

  // ── Session Depth ──
  if (d.depthBuckets.length > 0) {
    parts.push(`## Session Depth Distribution

${table(
      ['Depth', 'Sessions', 'Avg Duration'],
      d.depthBuckets.map(x => [x.bucket, Number(x.n), fmtSecs(Number(x.avg_seconds))])
    )}`);
  }

  // ── Friction ──
  const totalFriction = d.frictionByType.reduce((s, x) => s + Number(x.n), 0);
  if (totalFriction > 0) {
    const frictionTotals = ['exit_intent', 'mouse_thrash', 'rage_click', 'dead_click', 'form_abandonment']
      .map(type => {
        const row = d.frictionByType.find(r => r.eventType === type);
        return row ? `- **${frictionLabel(type)}:** ${row.n}` : `- **${frictionLabel(type)}:** 0`;
      }).join('\n');

    parts.push(`## Friction Signals

**Total friction events:** ${totalFriction}

${frictionTotals}

### Friction by Page

${table(
      ['Page', 'Event Type', 'Count'],
      d.frictionByPage.map(x => [x.path, frictionLabel(x.eventType), Number(x.n)])
    )}`);
  }

  // ── User Personas ──
  if (d.personaData?.personas?.length) {
    const pd = d.personaData;
    const genDate = d.personasGeneratedAt ? new Date(d.personasGeneratedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown';

    const personaSections = pd.personas.map(p => `### ${p.emoji} ${p.name} — ${p.archetype}

**Prevalence:** ${p.prevalence}% of visitors
**Primary Device:** ${p.primaryDevice} | **Avg Time:** ${fmtSecs(p.avgDurationSeconds)} | **Avg Pages:** ${p.avgPageViews}
**Typical Path:** \`${p.typicalEntryPage || '/'}\` → \`${p.typicalExitPage || '/'}\`
**Top Locations:** ${p.topLocations.join(', ')} | **Source:** ${p.primarySource}

> "${p.quote}"

**Goals:**
${p.goals.map(g => `- ${g}`).join('\n')}

**Observed Behaviors:**
${p.behaviors.map(b => `- ${b}`).join('\n')}

**Frustrations:**
${p.frustrations.map(f => `- ${f}`).join('\n')}

**Motivation:** ${p.motivations}`).join('\n\n');

    parts.push(`## User Personas

*Generated: ${genDate}*

**Audience Overview:** ${pd.summary}

${personaSections}`);
  }

  // ── Journey Map ──
  if (d.stages?.length && d.journeySummary) {
    const js = d.journeySummary;
    const genDate = d.journeyGeneratedAt ? new Date(d.journeyGeneratedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown';

    const stageSections = d.stages.map((s, i) => `### Stage ${i + 1}: ${s.name}

**Emotion:** ${s.emotion} (${s.emotionScore}/10) | **Friction:** ${s.frictionLevel} | **Drop-off:** ${s.metrics.dropOffRate}%
**Sessions reaching this stage:** ${s.metrics.sessionsReaching} | **Avg time:** ${fmtSecs(s.metrics.avgTimeSeconds)}

**Touchpoints:** ${s.touchpoints.join(', ')}

${s.description}

**User Actions:**
${s.userActions.map(a => `- ${a}`).join('\n')}

**User Thoughts:**
${s.userThoughts.map(t => `- "${t}"`).join('\n')}

**Pain Points:**
${s.painPoints.map(p => `- ${p}`).join('\n')}

**Opportunities:**
${s.opportunities.map(o => `- ${o}`).join('\n')}`).join('\n\n');

    parts.push(`## Customer Journey Map

*Generated: ${genDate}*

**Journey Health Score: ${js.journeyHealthScore}/100 ${healthEmoji(js.journeyHealthScore)}**

**Overall Narrative:** ${js.overallNarrative}

**Critical Moment:** ${js.criticalMoment}

**Biggest Drop-Off:** ${js.biggestDropOff.location} (${js.biggestDropOff.rate}% drop-off rate)
- **Why:** ${js.biggestDropOff.reason}
- **Fix:** ${js.biggestDropOff.fix}

**Top Opportunity:** ${js.topOpportunity}

${stageSections}`);
  }

  // ── Key Opportunities ──
  const opps: string[] = [];
  if (ov.bounceRate > 70) opps.push(`**Reduce homepage bounce rate (currently ${ov.bounceRate}%)** — Most visitors leave on the first page. The homepage is not communicating value quickly enough. Consider: clearer headline, featured work above the fold, and a single strong CTA.`);
  if (ov.avgScrollDepth < 30) opps.push(`**Improve scroll depth (currently ${ov.avgScrollDepth}% avg)** — Visitors are not reading far down any page. This suggests the above-the-fold content isn't creating pull. Shorter intros, visual anchors, and progressive disclosure could help.`);
  if (contactFriction > 5) opps.push(`**Fix contact page friction (${contactFriction} exit intents)** — High-intent visitors reach the contact page but leave anyway. Add a response time promise, reduce form fields, or offer a lighter-weight contact option (e.g. calendar booking link or visible email address).`);
  const mobileShare = d.devices.find(x => x.device === 'mobile');
  const mobilePercent = mobileShare ? Math.round((mobileShare.n / (d.devices.reduce((s, x) => s + x.n, 0) || 1)) * 100) : 0;
  if (mobilePercent > 40 && ov.avgScrollDepth < 25) opps.push(`**Improve mobile experience (${mobilePercent}% of sessions are mobile, avg scroll ${ov.avgScrollDepth}%)** — A large share of traffic is mobile but scroll depth is low, suggesting the mobile layout may not be pulling users down the page.`);
  if (d.journeySummary && d.stages) {
    const highFriction = d.stages.filter(s => s.frictionLevel === 'high');
    highFriction.forEach(s => opps.push(`**Reduce friction at "${s.name}" stage** — This stage is marked high friction. ${s.opportunities[0] || 'Review the pain points for this stage and address the top one.'}`));
  }
  if (!d.personaData) opps.push('**Generate user personas** — No personas exist for this period. Personas help translate raw metrics into actionable audience understanding.');
  if (!d.stages) opps.push('**Generate a customer journey map** — No journey map exists for this period. A journey map reveals where the funnel breaks and which stages need the most attention.');

  parts.push(`## Key Opportunities

${opps.length > 0 ? opps.map((o, i) => `${i + 1}. ${o}`).join('\n\n') : 'No opportunities automatically flagged. Review the data above for patterns.'}`);

  // ── Footer ──
  parts.push(`---

*Generated by behavioral insights on ${generated} — ${site.domain}*
*Use this report as context when working with Claude or other AI assistants for UX analysis, copywriting improvements, and conversion optimisation.*`);

  return parts.join('\n\n---\n\n');
}
