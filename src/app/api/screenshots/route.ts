import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { screenshots, sites, events } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

// POST - Store a new screenshot
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      siteId,
      sessionId,
      eventId,
      imageData,
      width,
      height,
      url,
      path,
      deviceType,
      timestamp
    } = body;

    if (!siteId || !sessionId || !imageData) {
      return NextResponse.json(
        { error: 'Missing required fields: siteId, sessionId, imageData' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Verify site exists and is active
    const site = await db.query.sites.findFirst({
      where: and(eq(sites.id, siteId), eq(sites.isActive, true)),
    });

    if (!site) {
      return NextResponse.json(
        { error: 'Invalid site ID' },
        { status: 403, headers: corsHeaders }
      );
    }

    // Check image size (limit to ~2MB base64 which is ~1.5MB actual)
    if (imageData.length > 2 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Screenshot too large. Maximum size is 2MB.' },
        { status: 413, headers: corsHeaders }
      );
    }

    // Store the screenshot
    const [screenshot] = await db.insert(screenshots).values({
      siteId,
      sessionId,
      eventId: eventId || null,
      path: path || '/',
      url: url || '',
      imageData,
      width: width || null,
      height: height || null,
      deviceType: deviceType || null,
      capturedAt: timestamp ? new Date(timestamp) : new Date(),
    }).returning();

    return NextResponse.json({
      success: true,
      screenshotId: screenshot.id
    }, { status: 201, headers: corsHeaders });

  } catch (error) {
    console.error('Error storing screenshot:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// GET - Retrieve screenshots for a session or specific event
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');
    const sessionId = searchParams.get('sessionId');
    const eventId = searchParams.get('eventId');
    const screenshotId = searchParams.get('id');

    if (!siteId) {
      return NextResponse.json(
        { error: 'Site ID is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Get a specific screenshot by ID
    if (screenshotId) {
      const screenshot = await db.query.screenshots.findFirst({
        where: and(
          eq(screenshots.id, screenshotId),
          eq(screenshots.siteId, siteId)
        ),
      });

      if (!screenshot) {
        return NextResponse.json(
          { error: 'Screenshot not found' },
          { status: 404, headers: corsHeaders }
        );
      }

      return NextResponse.json({ screenshot }, { headers: corsHeaders });
    }

    // Get screenshots for a specific event
    if (eventId) {
      const eventScreenshots = await db
        .select()
        .from(screenshots)
        .where(and(
          eq(screenshots.siteId, siteId),
          eq(screenshots.eventId, eventId)
        ));

      return NextResponse.json({
        screenshots: eventScreenshots
      }, { headers: corsHeaders });
    }

    // Get all screenshots for a session
    if (sessionId) {
      const sessionScreenshots = await db
        .select({
          id: screenshots.id,
          eventId: screenshots.eventId,
          path: screenshots.path,
          url: screenshots.url,
          width: screenshots.width,
          height: screenshots.height,
          deviceType: screenshots.deviceType,
          capturedAt: screenshots.capturedAt,
        })
        .from(screenshots)
        .where(and(
          eq(screenshots.siteId, siteId),
          eq(screenshots.sessionId, sessionId)
        ));

      return NextResponse.json({
        screenshots: sessionScreenshots
      }, { headers: corsHeaders });
    }

    return NextResponse.json(
      { error: 'Either sessionId, eventId, or id is required' },
      { status: 400, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Error fetching screenshots:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
