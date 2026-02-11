import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { events, sessions } from '@/lib/schema';
import { eq, and, gte, lte, sql, desc, count, avg } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import Anthropic from '@anthropic-ai/sdk';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');
    const period = searchParams.get('period') || '7d';
    const generateReport = searchParams.get('generateReport') === 'true';

    if (!siteId) {
      return NextResponse.json({ error: 'Site ID is required' }, { status: 400 });
    }

    const now = new Date();
    const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Get session metrics
    const sessionMetrics = await getSessionMetrics(siteId, start, now);

    // Get engagement patterns
    const engagementPatterns = await getEngagementPatterns(siteId, start, now);

    // Get navigation patterns
    const navigationPatterns = await getNavigationPatterns(siteId, start, now);

    // Get friction patterns (existing logic)
    const frictionPatterns = await getFrictionPatterns(siteId, start, now);

    // Get device patterns
    const devicePatterns = await getDevicePatterns(siteId, start, now);

    // Calculate site health score
    const siteHealthScore = calculateSiteHealth(sessionMetrics, frictionPatterns, engagementPatterns);

    // Identify red flags
    const redFlags = identifyRedFlags(sessionMetrics, frictionPatterns, engagementPatterns);

    // Generate AI report if requested
    let aiReport = null;
    if (generateReport) {
      aiReport = await generatePatternsReport({
        period,
        sessionMetrics,
        engagementPatterns,
        navigationPatterns,
        frictionPatterns,
        devicePatterns,
        siteHealthScore,
        redFlags
      });
    }

    return NextResponse.json({
      period,
      dateRange: { start, end: now },
      siteHealthScore,
      sessionMetrics,
      engagementPatterns,
      navigationPatterns,
      frictionPatterns,
      devicePatterns,
      redFlags,
      aiReport
    });
  } catch (error) {
    console.error('Error fetching patterns data:', error);
    return NextResponse.json({ error: 'Failed to fetch patterns data' }, { status: 500 });
  }
}

async function getSessionMetrics(siteId: string, start: Date, end: Date) {
  const [metrics] = await db
    .select({
      totalSessions: count(sessions.id),
      avgDuration: avg(sessions.duration),
      avgPageViews: avg(sessions.pageViews),
      avgClicks: avg(sessions.clicks),
      avgScrollDepth: avg(sessions.maxScrollDepth),
      bounceCount: sql<number>`sum(case when ${sessions.isBounce} = true then 1 else 0 end)`,
    })
    .from(sessions)
    .where(and(
      eq(sessions.siteId, siteId),
      gte(sessions.startedAt, start),
      lte(sessions.startedAt, end)
    ));

  const totalSessions = Number(metrics.totalSessions) || 0;
  const bounceCount = Number(metrics.bounceCount) || 0;

  return {
    totalSessions,
    avgDuration: Math.round(Number(metrics.avgDuration) || 0),
    avgPageViews: Math.round((Number(metrics.avgPageViews) || 0) * 10) / 10,
    avgClicks: Math.round((Number(metrics.avgClicks) || 0) * 10) / 10,
    avgScrollDepth: Math.round(Number(metrics.avgScrollDepth) || 0),
    bounceRate: totalSessions > 0 ? Math.round((bounceCount / totalSessions) * 100) : 0,
    bounceCount
  };
}

async function getEngagementPatterns(siteId: string, start: Date, end: Date) {
  // Scroll depth distribution
  const scrollData = await db
    .select({
      depth: sessions.maxScrollDepth
    })
    .from(sessions)
    .where(and(
      eq(sessions.siteId, siteId),
      gte(sessions.startedAt, start),
      lte(sessions.startedAt, end)
    ));

  const scrollDistribution = {
    shallow: 0,  // 0-25%
    partial: 0,  // 25-50%
    good: 0,     // 50-75%
    deep: 0      // 75-100%
  };

  for (const row of scrollData) {
    const depth = Number(row.depth) || 0;
    if (depth < 25) scrollDistribution.shallow++;
    else if (depth < 50) scrollDistribution.partial++;
    else if (depth < 75) scrollDistribution.good++;
    else scrollDistribution.deep++;
  }

  // Session duration distribution
  const durationData = await db
    .select({
      duration: sessions.duration
    })
    .from(sessions)
    .where(and(
      eq(sessions.siteId, siteId),
      gte(sessions.startedAt, start),
      lte(sessions.startedAt, end)
    ));

  const durationDistribution = {
    veryShort: 0,  // <10s
    short: 0,      // 10-30s
    medium: 0,     // 30-120s
    long: 0        // >120s
  };

  for (const row of durationData) {
    const duration = Number(row.duration) || 0;
    const seconds = duration / 1000;
    if (seconds < 10) durationDistribution.veryShort++;
    else if (seconds < 30) durationDistribution.short++;
    else if (seconds < 120) durationDistribution.medium++;
    else durationDistribution.long++;
  }

  // Top engaged pages (by time spent)
  const pageEngagement = await db
    .select({
      path: events.path,
      avgTime: sql<number>`avg(case when ${events.eventType} = 'pageexit' then (${events.eventData}->>'timeOnPage')::numeric else null end)`,
      views: count(sql`case when ${events.eventType} = 'pageview' then 1 end`)
    })
    .from(events)
    .where(and(
      eq(events.siteId, siteId),
      gte(events.timestamp, start),
      lte(events.timestamp, end)
    ))
    .groupBy(events.path)
    .orderBy(desc(sql`count(case when ${events.eventType} = 'pageview' then 1 end)`))
    .limit(10);

  return {
    scrollDistribution,
    durationDistribution,
    topPages: pageEngagement.map(p => ({
      path: p.path,
      views: Number(p.views) || 0,
      avgTimeOnPage: Math.round(Number(p.avgTime) || 0)
    }))
  };
}

async function getNavigationPatterns(siteId: string, start: Date, end: Date) {
  // Top entry pages
  const entryPages = await db
    .select({
      page: sessions.entryPage,
      count: count(sessions.id)
    })
    .from(sessions)
    .where(and(
      eq(sessions.siteId, siteId),
      gte(sessions.startedAt, start),
      lte(sessions.startedAt, end)
    ))
    .groupBy(sessions.entryPage)
    .orderBy(desc(count(sessions.id)))
    .limit(10);

  // Top exit pages
  const exitPages = await db
    .select({
      page: sessions.exitPage,
      count: count(sessions.id)
    })
    .from(sessions)
    .where(and(
      eq(sessions.siteId, siteId),
      gte(sessions.startedAt, start),
      lte(sessions.startedAt, end)
    ))
    .groupBy(sessions.exitPage)
    .orderBy(desc(count(sessions.id)))
    .limit(10);

  // Calculate exit rates per page
  const totalSessions = entryPages.reduce((sum, p) => sum + Number(p.count), 0);

  return {
    topEntryPages: entryPages.map(p => ({
      page: p.page || '/',
      count: Number(p.count),
      percentage: totalSessions > 0 ? Math.round((Number(p.count) / totalSessions) * 100) : 0
    })),
    topExitPages: exitPages.map(p => ({
      page: p.page || '/',
      count: Number(p.count),
      exitRate: totalSessions > 0 ? Math.round((Number(p.count) / totalSessions) * 100) : 0
    }))
  };
}

async function getFrictionPatterns(siteId: string, start: Date, end: Date) {
  // Get friction events
  const frictionEvents = await db
    .select({
      eventType: events.eventType,
      path: events.path,
      sessionId: events.sessionId,
      eventData: events.eventData
    })
    .from(events)
    .where(and(
      eq(events.siteId, siteId),
      gte(events.timestamp, start),
      lte(events.timestamp, end),
      sql`${events.eventType} IN ('rage_click', 'dead_click', 'mouse_thrash', 'form_abandonment', 'form_field_skip', 'exit_intent')`
    ));

  // Count by type
  const counts = {
    rageClicks: frictionEvents.filter(e => e.eventType === 'rage_click').length,
    deadClicks: frictionEvents.filter(e => e.eventType === 'dead_click').length,
    mouseThrashes: frictionEvents.filter(e => e.eventType === 'mouse_thrash').length,
    formAbandonments: frictionEvents.filter(e => e.eventType === 'form_abandonment').length,
    fieldSkips: frictionEvents.filter(e => e.eventType === 'form_field_skip').length,
    exitIntents: frictionEvents.filter(e => e.eventType === 'exit_intent').length
  };

  // Sessions with friction
  const sessionsWithFriction = new Set(frictionEvents.map(e => e.sessionId)).size;

  // Get total sessions for friction rate
  const [sessionCount] = await db
    .select({ count: count(sessions.id) })
    .from(sessions)
    .where(and(
      eq(sessions.siteId, siteId),
      gte(sessions.startedAt, start),
      lte(sessions.startedAt, end)
    ));

  const totalSessions = Number(sessionCount.count) || 0;
  const frictionRate = totalSessions > 0 ? Math.round((sessionsWithFriction / totalSessions) * 100) : 0;

  // Friction by page
  const frictionByPage = new Map<string, { total: number; types: Record<string, number> }>();
  for (const event of frictionEvents) {
    const page = event.path;
    if (!frictionByPage.has(page)) {
      frictionByPage.set(page, { total: 0, types: {} });
    }
    const data = frictionByPage.get(page)!;
    data.total++;
    data.types[event.eventType] = (data.types[event.eventType] || 0) + 1;
  }

  const topFrictionPages = Array.from(frictionByPage.entries())
    .map(([page, data]) => ({ page, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return {
    counts,
    sessionsWithFriction,
    frictionRate,
    topFrictionPages
  };
}

async function getDevicePatterns(siteId: string, start: Date, end: Date) {
  const deviceData = await db
    .select({
      deviceType: sessions.deviceType,
      count: count(sessions.id),
      avgDuration: avg(sessions.duration),
      avgScrollDepth: avg(sessions.maxScrollDepth),
      bounceCount: sql<number>`sum(case when ${sessions.isBounce} = true then 1 else 0 end)`
    })
    .from(sessions)
    .where(and(
      eq(sessions.siteId, siteId),
      gte(sessions.startedAt, start),
      lte(sessions.startedAt, end)
    ))
    .groupBy(sessions.deviceType);

  return deviceData.map(d => ({
    device: d.deviceType || 'unknown',
    sessions: Number(d.count) || 0,
    avgDuration: Math.round(Number(d.avgDuration) || 0),
    avgScrollDepth: Math.round(Number(d.avgScrollDepth) || 0),
    bounceRate: Number(d.count) > 0 ? Math.round((Number(d.bounceCount) / Number(d.count)) * 100) : 0
  }));
}

function calculateSiteHealth(
  sessionMetrics: Awaited<ReturnType<typeof getSessionMetrics>>,
  frictionPatterns: Awaited<ReturnType<typeof getFrictionPatterns>>,
  engagementPatterns: Awaited<ReturnType<typeof getEngagementPatterns>>
): number {
  let score = 100;

  // Bounce rate penalty (up to -30)
  if (sessionMetrics.bounceRate > 70) score -= 30;
  else if (sessionMetrics.bounceRate > 50) score -= 20;
  else if (sessionMetrics.bounceRate > 30) score -= 10;

  // Friction rate penalty (up to -25)
  if (frictionPatterns.frictionRate > 30) score -= 25;
  else if (frictionPatterns.frictionRate > 20) score -= 15;
  else if (frictionPatterns.frictionRate > 10) score -= 8;

  // Short sessions penalty (up to -20)
  const shortSessionRate = (engagementPatterns.durationDistribution.veryShort + engagementPatterns.durationDistribution.short) /
    Math.max(Object.values(engagementPatterns.durationDistribution).reduce((a, b) => a + b, 0), 1);
  if (shortSessionRate > 0.7) score -= 20;
  else if (shortSessionRate > 0.5) score -= 12;
  else if (shortSessionRate > 0.3) score -= 5;

  // Shallow scroll penalty (up to -15)
  const shallowScrollRate = engagementPatterns.scrollDistribution.shallow /
    Math.max(Object.values(engagementPatterns.scrollDistribution).reduce((a, b) => a + b, 0), 1);
  if (shallowScrollRate > 0.6) score -= 15;
  else if (shallowScrollRate > 0.4) score -= 8;
  else if (shallowScrollRate > 0.2) score -= 3;

  // Bonus for good engagement (up to +10)
  if (sessionMetrics.avgScrollDepth > 70) score += 5;
  if (sessionMetrics.avgPageViews > 3) score += 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

interface RedFlag {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  metric: string;
  value: number;
  threshold: number;
  message: string;
}

function identifyRedFlags(
  sessionMetrics: Awaited<ReturnType<typeof getSessionMetrics>>,
  frictionPatterns: Awaited<ReturnType<typeof getFrictionPatterns>>,
  engagementPatterns: Awaited<ReturnType<typeof getEngagementPatterns>>
): RedFlag[] {
  const flags: RedFlag[] = [];

  // Bounce rate check
  if (sessionMetrics.bounceRate > 70) {
    flags.push({
      type: 'bounce_rate',
      severity: 'critical',
      metric: 'Bounce Rate',
      value: sessionMetrics.bounceRate,
      threshold: 70,
      message: 'Critical: Most visitors leave without engaging'
    });
  } else if (sessionMetrics.bounceRate > 50) {
    flags.push({
      type: 'bounce_rate',
      severity: 'high',
      metric: 'Bounce Rate',
      value: sessionMetrics.bounceRate,
      threshold: 50,
      message: 'High bounce rate indicates content/UX issues'
    });
  }

  // Friction rate check
  if (frictionPatterns.frictionRate > 25) {
    flags.push({
      type: 'friction_rate',
      severity: 'critical',
      metric: 'Friction Rate',
      value: frictionPatterns.frictionRate,
      threshold: 25,
      message: 'Critical: Too many users experiencing frustration'
    });
  } else if (frictionPatterns.frictionRate > 15) {
    flags.push({
      type: 'friction_rate',
      severity: 'high',
      metric: 'Friction Rate',
      value: frictionPatterns.frictionRate,
      threshold: 15,
      message: 'High friction rate causing user frustration'
    });
  }

  // Session duration check
  const avgDurationSec = sessionMetrics.avgDuration / 1000;
  if (avgDurationSec < 15) {
    flags.push({
      type: 'session_duration',
      severity: 'critical',
      metric: 'Avg Session Duration',
      value: Math.round(avgDurationSec),
      threshold: 15,
      message: 'Critical: Users leaving almost immediately'
    });
  } else if (avgDurationSec < 30) {
    flags.push({
      type: 'session_duration',
      severity: 'high',
      metric: 'Avg Session Duration',
      value: Math.round(avgDurationSec),
      threshold: 30,
      message: 'Very short sessions indicate poor engagement'
    });
  }

  // Scroll depth check
  if (sessionMetrics.avgScrollDepth < 20) {
    flags.push({
      type: 'scroll_depth',
      severity: 'high',
      metric: 'Avg Scroll Depth',
      value: sessionMetrics.avgScrollDepth,
      threshold: 20,
      message: 'Users not scrolling - content above fold may be problematic'
    });
  }

  // Rage clicks check
  if (frictionPatterns.counts.rageClicks > 50) {
    flags.push({
      type: 'rage_clicks',
      severity: 'high',
      metric: 'Rage Clicks',
      value: frictionPatterns.counts.rageClicks,
      threshold: 50,
      message: 'High rage click count indicates broken/slow UI elements'
    });
  }

  // Form abandonment check
  if (frictionPatterns.counts.formAbandonments > 20) {
    flags.push({
      type: 'form_abandonment',
      severity: 'high',
      metric: 'Form Abandonments',
      value: frictionPatterns.counts.formAbandonments,
      threshold: 20,
      message: 'Forms are causing significant friction'
    });
  }

  return flags.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

async function generatePatternsReport(data: {
  period: string;
  sessionMetrics: Awaited<ReturnType<typeof getSessionMetrics>>;
  engagementPatterns: Awaited<ReturnType<typeof getEngagementPatterns>>;
  navigationPatterns: Awaited<ReturnType<typeof getNavigationPatterns>>;
  frictionPatterns: Awaited<ReturnType<typeof getFrictionPatterns>>;
  devicePatterns: Awaited<ReturnType<typeof getDevicePatterns>>;
  siteHealthScore: number;
  redFlags: RedFlag[];
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { error: 'AI analysis unavailable', source: 'fallback' };
  }

  const prompt = `You are an expert UX researcher analyzing behavioral patterns across all users on a website. Your goal is to identify what these aggregate patterns reveal about the site's usability, user psychology, and areas needing improvement.

=== SITE HEALTH OVERVIEW ===
Site Health Score: ${data.siteHealthScore}/100
Period: Last ${data.period === '7d' ? '7 days' : data.period === '30d' ? '30 days' : '90 days'}

=== SESSION METRICS ===
- Total Sessions: ${data.sessionMetrics.totalSessions}
- Average Duration: ${Math.round(data.sessionMetrics.avgDuration / 1000)}s
- Average Page Views: ${data.sessionMetrics.avgPageViews}
- Average Scroll Depth: ${data.sessionMetrics.avgScrollDepth}%
- Bounce Rate: ${data.sessionMetrics.bounceRate}%

=== ENGAGEMENT PATTERNS ===

Scroll Depth Distribution:
- Shallow (0-25%): ${data.engagementPatterns.scrollDistribution.shallow} sessions
- Partial (25-50%): ${data.engagementPatterns.scrollDistribution.partial} sessions
- Good (50-75%): ${data.engagementPatterns.scrollDistribution.good} sessions
- Deep (75-100%): ${data.engagementPatterns.scrollDistribution.deep} sessions

Session Duration Distribution:
- Very Short (<10s): ${data.engagementPatterns.durationDistribution.veryShort} sessions
- Short (10-30s): ${data.engagementPatterns.durationDistribution.short} sessions
- Medium (30-120s): ${data.engagementPatterns.durationDistribution.medium} sessions
- Long (>120s): ${data.engagementPatterns.durationDistribution.long} sessions

Top Pages by Views:
${data.engagementPatterns.topPages.slice(0, 5).map((p, i) => `${i + 1}. ${p.path} - ${p.views} views`).join('\n')}

=== NAVIGATION PATTERNS ===

Top Entry Pages:
${data.navigationPatterns.topEntryPages.slice(0, 5).map((p, i) => `${i + 1}. ${p.page} (${p.percentage}%)`).join('\n')}

Top Exit Pages:
${data.navigationPatterns.topExitPages.slice(0, 5).map((p, i) => `${i + 1}. ${p.page} (${p.exitRate}% of exits)`).join('\n')}

=== FRICTION PATTERNS ===
- Friction Rate: ${data.frictionPatterns.frictionRate}% of sessions
- Rage Clicks: ${data.frictionPatterns.counts.rageClicks}
- Dead Clicks: ${data.frictionPatterns.counts.deadClicks}
- Mouse Thrashing: ${data.frictionPatterns.counts.mouseThrashes}
- Form Abandonments: ${data.frictionPatterns.counts.formAbandonments}
- Exit Intents: ${data.frictionPatterns.counts.exitIntents}

Top Friction Pages:
${data.frictionPatterns.topFrictionPages.slice(0, 5).map((p, i) => `${i + 1}. ${p.page} - ${p.total} friction events`).join('\n')}

=== DEVICE PATTERNS ===
${data.devicePatterns.map(d => `${d.device}: ${d.sessions} sessions, ${d.bounceRate}% bounce, ${d.avgScrollDepth}% scroll`).join('\n')}

=== RED FLAGS DETECTED ===
${data.redFlags.map(f => `[${f.severity.toUpperCase()}] ${f.metric}: ${f.value} (threshold: ${f.threshold}) - ${f.message}`).join('\n') || 'None'}

=== OUTPUT FORMAT ===

Return a JSON object with comprehensive pattern analysis:

{
  "executiveSummary": "3-4 sentence summary of the site's behavioral health and key findings",

  "behavioralPatterns": [
    {
      "pattern": "Name of the pattern (e.g., 'Quick Bounce Pattern', 'Deep Engagement Pattern')",
      "description": "What users are doing",
      "frequency": "What percentage/count of users exhibit this",
      "interpretation": "What this pattern reveals about the site",
      "implication": "What this means for the business"
    }
  ],

  "siteInterpretation": {
    "contentEffectiveness": "Assessment of how well content engages users",
    "navigationClarity": "Assessment of how easy it is to navigate",
    "conversionReadiness": "Assessment of how well the site converts",
    "overallExperience": "Overall user experience assessment"
  },

  "usabilityIssues": [
    {
      "issue": "Specific usability problem",
      "evidence": "Data supporting this issue",
      "affectedUsers": "Percentage or count affected",
      "severity": "critical|high|medium|low",
      "recommendation": "How to fix it"
    }
  ],

  "collectiveMindset": {
    "dominantStates": ["List of most common user psychological states"],
    "frustrationLevel": "low|moderate|high|critical",
    "intentClarity": "How clear users' goals seem to be",
    "satisfactionIndicators": "Signs of user satisfaction or dissatisfaction"
  },

  "redFlagAnalysis": [
    {
      "flag": "The red flag",
      "rootCause": "Why this is happening",
      "businessImpact": "How this affects the business",
      "urgency": "How quickly this needs attention",
      "actionPlan": "Specific steps to address it"
    }
  ],

  "prioritizedRecommendations": [
    {
      "priority": 1,
      "recommendation": "Specific recommendation",
      "expectedImpact": "What improvement to expect",
      "effort": "low|medium|high"
    }
  ]
}

Focus on interpreting PATTERNS, not just listing data. Explain what user behavior reveals about the site. Be specific and actionable.
Return ONLY the JSON object.`;

  try {
    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return { ...parsed, source: 'ai' };
      }
    }

    return { error: 'Could not parse AI response', source: 'fallback' };
  } catch (error) {
    console.error('Error generating patterns report:', error);
    return { error: 'AI analysis failed', source: 'fallback' };
  }
}
