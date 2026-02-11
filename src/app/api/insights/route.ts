import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessions, insights } from '@/lib/schema';
import { eq, and, gte, lte, sql, count, avg, countDistinct } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const { siteId, period = '7d' } = await request.json();

    if (!siteId) {
      return NextResponse.json({ error: 'Site ID is required' }, { status: 400 });
    }

    const now = new Date();
    const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
    const currentStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const previousStart = new Date(currentStart.getTime() - days * 24 * 60 * 60 * 1000);

    const currentMetrics = await getMetrics(siteId, currentStart, now);
    const previousMetrics = await getMetrics(siteId, previousStart, currentStart);

    const aiInsights = await generateInsights(currentMetrics, previousMetrics, `${days} days`);

    const storedInsights = [];
    for (const insight of aiInsights) {
      const [stored] = await db.insert(insights).values({
        siteId, type: insight.type, severity: insight.severity,
        title: insight.title, description: insight.description,
        metric: insight.metric, value: insight.value,
        previousValue: insight.previousValue, changePercent: insight.changePercent,
        periodStart: currentStart, periodEnd: now,
      }).returning();
      storedInsights.push(stored);
    }

    return NextResponse.json({ insights: storedInsights });
  } catch (error) {
    console.error('Error generating insights:', error);
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');

    if (!siteId) {
      return NextResponse.json({ error: 'Site ID is required' }, { status: 400 });
    }

    const siteInsights = await db.query.insights.findMany({
      where: and(eq(insights.siteId, siteId), eq(insights.isDismissed, false)),
      orderBy: (insights, { desc }) => [desc(insights.createdAt)],
      limit: 10,
    });

    return NextResponse.json({ insights: siteInsights });
  } catch (error) {
    console.error('Error fetching insights:', error);
    return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 });
  }
}

async function getMetrics(siteId: string, start: Date, end: Date) {
  const [result] = await db
    .select({
      totalSessions: count(sessions.id),
      uniqueVisitors: countDistinct(sessions.visitorId),
      totalPageViews: sql<number>`COALESCE(SUM(${sessions.pageViews}), 0)`,
      avgSessionDuration: avg(sessions.duration),
      avgScrollDepth: avg(sessions.maxScrollDepth),
      bounceCount: sql<number>`COUNT(CASE WHEN ${sessions.isBounce} = true THEN 1 END)`,
    })
    .from(sessions)
    .where(and(eq(sessions.siteId, siteId), gte(sessions.startedAt, start), lte(sessions.startedAt, end)));

  return {
    sessions: Number(result.totalSessions),
    visitors: Number(result.uniqueVisitors),
    pageViews: Number(result.totalPageViews),
    avgDuration: Math.round(Number(result.avgSessionDuration) / 1000) || 0,
    avgScrollDepth: Math.round(Number(result.avgScrollDepth)) || 0,
    bounceRate: result.totalSessions > 0 ? Math.round((result.bounceCount / result.totalSessions) * 100) : 0,
  };
}

async function generateInsights(current: Record<string, number>, previous: Record<string, number>, period: string) {
  const prompt = `Analyze this web analytics data and generate 3-5 insights as JSON array.

Current Period (${period}): Sessions: ${current.sessions}, Visitors: ${current.visitors}, Page Views: ${current.pageViews}, Avg Duration: ${current.avgDuration}s, Scroll Depth: ${current.avgScrollDepth}%, Bounce Rate: ${current.bounceRate}%

Previous Period: Sessions: ${previous.sessions}, Visitors: ${previous.visitors}, Page Views: ${previous.pageViews}, Avg Duration: ${previous.avgDuration}s, Scroll Depth: ${previous.avgScrollDepth}%, Bounce Rate: ${previous.bounceRate}%

Return JSON array with objects containing: type (summary|anomaly|trend|recommendation), severity (info|warning|critical), title (max 60 chars), description (2-3 sentences), metric, value, previousValue, changePercent.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      const jsonMatch = content.text.match(/\[[\s\S]*\]/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('Claude API error:', error);
  }

  // Fallback insights
  const fallbackInsights = [];
  if (previous.sessions > 0) {
    const change = ((current.sessions - previous.sessions) / previous.sessions) * 100;
    if (Math.abs(change) > 10) {
      fallbackInsights.push({
        type: 'trend', severity: change < -20 ? 'warning' : 'info',
        title: change > 0 ? 'Traffic Increase' : 'Traffic Decrease',
        description: `Sessions ${change > 0 ? 'increased' : 'decreased'} by ${Math.abs(Math.round(change))}%.`,
        metric: 'sessions', value: current.sessions, previousValue: previous.sessions, changePercent: Math.round(change),
      });
    }
  }
  return fallbackInsights.length ? fallbackInsights : [{ type: 'summary', severity: 'info', title: 'Period Summary', description: `${current.sessions} sessions with ${current.visitors} visitors.` }];
}
