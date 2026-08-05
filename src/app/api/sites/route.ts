import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sites } from '@/lib/schema';
import { nanoid } from 'nanoid';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { isValidExclusionEntry } from '@/lib/ip-filter';

export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userSites = await db.query.sites.findMany({
      where: eq(sites.userId, session.user.id),
      orderBy: (sites, { desc }) => [desc(sites.createdAt)],
    });
    
    return NextResponse.json({ sites: userSites });
  } catch (error) {
    console.error('Error fetching sites:', error);
    return NextResponse.json({ error: 'Failed to fetch sites' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, domain } = await request.json();

    if (!name || !domain) {
      return NextResponse.json({ error: 'Name and domain are required' }, { status: 400 });
    }

    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
    const apiKey = `bi_${nanoid(32)}`;

    const [newSite] = await db.insert(sites).values({ 
      name, 
      domain: cleanDomain, 
      apiKey,
      userId: session.user.id 
    }).returning();

    return NextResponse.json({ 
      site: newSite,
      trackingCode: `<script src="${process.env.NEXT_PUBLIC_APP_URL || 'https://behavioral-insights.vercel.app'}/tracker.js" data-site-id="${newSite.id}"></script>`,
    });
  } catch (error) {
    console.error('Error creating site:', error);
    return NextResponse.json({ error: 'Failed to create site' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { siteId } = body;

    if (!siteId) {
      return NextResponse.json({ error: 'Site ID is required' }, { status: 400 });
    }

    // Only update fields present in the request
    const updates: Record<string, unknown> = {};
    if ('businessType' in body) updates.businessType = body.businessType;
    if ('description' in body) updates.description = body.description;
    if ('targetAudience' in body) updates.targetAudience = body.targetAudience;
    if ('primaryGoals' in body) updates.primaryGoals = body.primaryGoals;
    if ('pageContext' in body) updates.pageContext = body.pageContext ? JSON.stringify(body.pageContext) : null;
    if ('siteCategory' in body) updates.siteCategory = body.siteCategory || null;
    if ('relevantMetrics' in body) updates.relevantMetrics = Array.isArray(body.relevantMetrics) ? body.relevantMetrics : null;
    if ('ipExclusionEnabled' in body) updates.ipExclusionEnabled = Boolean(body.ipExclusionEnabled);
    if ('excludedIps' in body) {
      const list = body.excludedIps;
      if (!Array.isArray(list) || list.some((ip: unknown) => typeof ip !== 'string' || !isValidExclusionEntry(ip))) {
        return NextResponse.json(
          { error: 'excludedIps must be an array of valid IP addresses or IPv4 CIDR ranges' },
          { status: 400 }
        );
      }
      updates.excludedIps = list.map((ip: string) => ip.trim());
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const [updatedSite] = await db
      .update(sites)
      .set(updates)
      .where(and(eq(sites.id, siteId), eq(sites.userId, session.user.id)))
      .returning();

    return NextResponse.json({ site: updatedSite });
  } catch (error) {
    console.error('Error updating site:', error);
    return NextResponse.json({ error: 'Failed to update site' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('id');

    if (!siteId) {
      return NextResponse.json({ error: 'Site ID is required' }, { status: 400 });
    }

    await db.delete(sites).where(and(eq(sites.id, siteId), eq(sites.userId, session.user.id)));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting site:', error);
    return NextResponse.json({ error: 'Failed to delete site' }, { status: 500 });
  }
}
