import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sites } from '@/lib/schema';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const allSites = await db.query.sites.findMany({
      orderBy: (sites, { desc }) => [desc(sites.createdAt)],
    });
    return NextResponse.json({ sites: allSites });
  } catch (error) {
    console.error('Error fetching sites:', error);
    return NextResponse.json({ error: 'Failed to fetch sites' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, domain } = await request.json();

    if (!name || !domain) {
      return NextResponse.json({ error: 'Name and domain are required' }, { status: 400 });
    }

    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
    const apiKey = `bi_${nanoid(32)}`;

    const [newSite] = await db.insert(sites).values({ name, domain: cleanDomain, apiKey }).returning();

    return NextResponse.json({ 
      site: newSite,
      trackingCode: `<script src="${process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.vercel.app'}/tracker.js" data-site-id="${newSite.id}"></script>`,
    });
  } catch (error) {
    console.error('Error creating site:', error);
    return NextResponse.json({ error: 'Failed to create site' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('id');

    if (!siteId) {
      return NextResponse.json({ error: 'Site ID is required' }, { status: 400 });
    }

    await db.delete(sites).where(eq(sites.id, siteId));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting site:', error);
    return NextResponse.json({ error: 'Failed to delete site' }, { status: 500 });
  }
}
