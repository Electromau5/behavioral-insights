import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessions } from '@/lib/schema';
import { eq, and, gte, lte, sql, count, avg, countDistinct } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');
    const period = searchParams.get('period') || '7d';

    if (!siteId) {
      return NextResponse.json({ error: 'Site ID is required' }, { status: 400 });
    }

    const now = new Date();
    const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

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
      .where(and(eq(sessions.siteId, siteId), gte(sessions.startedAt, start), lte(sessions.startedAt, now)));

    const bounceRate = overview.totalSessions > 0 ? (overview.bounceCount / overview.totalSessions) * 100 : 0;

    const topPages = await db
      .select({ path: sessions.entryPage, views: count(sessions.id), avgDuration: avg(sessions.duration) })
      .from(sessions)
      .where(and(eq(sessions.siteId, siteId), gte(sessions.startedAt, start), lte(sessions.startedAt, now)))
      .groupBy(sessions.entryPage)
      .orderBy(sql`count(*) DESC`)
      .limit(10);

    const deviceBreakdown = await db
      .select({ device: sessions.deviceType, count: count(sessions.id) })
      .from(sessions)
      .where(and(eq(sessions.siteId, siteId), gte(sessions.startedAt, start), lte(sessions.startedAt, now)))
      .groupBy(sessions.deviceType);

    return NextResponse.json({
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
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
}
