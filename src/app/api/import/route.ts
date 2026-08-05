import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sites, sessions, events, insights, userFlows } from '@/lib/schema';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const backup = await request.json();

    if (!backup?.version || !Array.isArray(backup.sites)) {
      return NextResponse.json({ error: 'Invalid backup file' }, { status: 400 });
    }

    const counts = { sites: 0, sessions: 0, events: 0, insights: 0, userFlows: 0 };

    // Sites — always owned by the current user
    if (backup.sites?.length) {
      for (const site of backup.sites) {
        await db
          .insert(sites)
          .values({ ...site, userId })
          .onConflictDoUpdate({
            target: sites.id,
            set: {
              name: site.name,
              domain: site.domain,
              businessType: site.businessType,
              description: site.description,
              targetAudience: site.targetAudience,
              primaryGoals: site.primaryGoals,
              pageContext: site.pageContext,
              siteCategory: site.siteCategory,
              relevantMetrics: site.relevantMetrics,
              ipExclusionEnabled: site.ipExclusionEnabled,
              excludedIps: site.excludedIps,
              isActive: site.isActive,
            },
          });
        counts.sites++;
      }
    }

    // Sessions
    if (backup.sessions?.length) {
      for (const s of backup.sessions) {
        await db
          .insert(sessions)
          .values(s)
          .onConflictDoNothing();
        counts.sessions++;
      }
    }

    // Events
    if (backup.events?.length) {
      for (const e of backup.events) {
        await db
          .insert(events)
          .values(e)
          .onConflictDoNothing();
        counts.events++;
      }
    }

    // Insights
    if (backup.insights?.length) {
      for (const insight of backup.insights) {
        await db
          .insert(insights)
          .values(insight)
          .onConflictDoNothing();
        counts.insights++;
      }
    }

    // User flows
    if (backup.userFlows?.length) {
      for (const flow of backup.userFlows) {
        await db
          .insert(userFlows)
          .values(flow)
          .onConflictDoNothing();
        counts.userFlows++;
      }
    }

    return NextResponse.json({ success: true, imported: counts });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}
