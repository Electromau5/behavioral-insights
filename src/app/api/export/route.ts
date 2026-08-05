import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sites, sessions, events, insights, userFlows } from '@/lib/schema';
import { eq, inArray } from 'drizzle-orm';
import { auth } from '@/lib/auth';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    const userSites = await db.query.sites.findMany({
      where: eq(sites.userId, userId),
    });

    const siteIds = userSites.map(s => s.id);

    const [userSessions, userEvents, userInsights, userFlowRows] = siteIds.length
      ? await Promise.all([
          db.query.sessions.findMany({ where: inArray(sessions.siteId, siteIds) }),
          db.query.events.findMany({ where: inArray(events.siteId, siteIds) }),
          db.query.insights.findMany({ where: inArray(insights.siteId, siteIds) }),
          db.query.userFlows.findMany({ where: inArray(userFlows.siteId, siteIds) }),
        ])
      : [[], [], [], []];

    const backup = {
      version: '1',
      exportedAt: new Date().toISOString(),
      userId,
      counts: {
        sites: userSites.length,
        sessions: userSessions.length,
        events: userEvents.length,
        insights: userInsights.length,
        userFlows: userFlowRows.length,
      },
      sites: userSites,
      sessions: userSessions,
      events: userEvents,
      insights: userInsights,
      userFlows: userFlowRows,
    };

    const filename = `behavioral-insights-backup-${new Date().toISOString().split('T')[0]}.json`;

    return new NextResponse(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
