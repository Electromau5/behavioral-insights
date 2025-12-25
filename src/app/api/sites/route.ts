import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sites } from '@/lib/schema';
import { nanoid } from 'nanoid';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';

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

    const { 
      siteId, 
      businessType, 
      description, 
      targetAudience, 
      primaryGoals, 
      pageContext 
    } = await request.json();

    if (!siteId) {
      return NextResponse.json({ error: 'Site ID is required' }, { status: 400 });
    }

    const [updatedSite] = await db
      .update(sites)
      .set({
        businessType,
        description,
        targetAudience,
        primaryGoals,
        pageContext: pageContext ? JSON.stringify(pageContext) : null
      })
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
