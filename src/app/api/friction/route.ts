import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { events, sessions } from '@/lib/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import Anthropic from '@anthropic-ai/sdk';

interface FrictionEvent {
  id: string;
  eventType: string;
  path: string;
  timestamp: Date;
  eventData: Record<string, unknown> | null;
  sessionId: string;
}

interface FrictionByPage {
  path: string;
  rageClicks: number;
  deadClicks: number;
  mouseThrashes: number;
  formAbandonments: number;
  fieldSkips: number;
  totalFriction: number;
  frictionScore: number;
  sessions: number;
  topIssues: Array<{
    type: string;
    element?: string;
    count: number;
    details?: string;
  }>;
}

interface FormFriction {
  formId: string | null;
  formName: string | null;
  path: string;
  abandonments: number;
  completions: number;
  abandonmentRate: number;
  problemFields: Array<{
    fieldName: string;
    fieldLabel: string | null;
    skips: number;
    abandonedAt: number;
  }>;
}

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

    // Get all friction-related events
    const frictionEvents = await db
      .select({
        id: events.id,
        eventType: events.eventType,
        path: events.path,
        timestamp: events.timestamp,
        eventData: events.eventData,
        sessionId: events.sessionId
      })
      .from(events)
      .where(and(
        eq(events.siteId, siteId),
        gte(events.timestamp, start),
        lte(events.timestamp, now),
        sql`${events.eventType} IN ('rage_click', 'dead_click', 'mouse_thrash', 'form_abandonment', 'form_field_skip', 'exit_intent')`
      ))
      .orderBy(desc(events.timestamp));

    // Get session count for the period
    const [sessionCount] = await db
      .select({ count: sql<number>`count(distinct ${events.sessionId})` })
      .from(events)
      .where(and(
        eq(events.siteId, siteId),
        gte(events.timestamp, start),
        lte(events.timestamp, now)
      ));

    // Aggregate friction by page
    const frictionByPage = aggregateFrictionByPage(frictionEvents as FrictionEvent[], Number(sessionCount.count));

    // Analyze form friction
    const formFriction = analyzeFormFriction(frictionEvents as FrictionEvent[]);

    // Get overall friction stats
    const overallStats = {
      totalSessions: Number(sessionCount.count),
      totalRageClicks: frictionEvents.filter(e => e.eventType === 'rage_click').length,
      totalDeadClicks: frictionEvents.filter(e => e.eventType === 'dead_click').length,
      totalMouseThrashes: frictionEvents.filter(e => e.eventType === 'mouse_thrash').length,
      totalFormAbandonments: frictionEvents.filter(e => e.eventType === 'form_abandonment').length,
      totalFieldSkips: frictionEvents.filter(e => e.eventType === 'form_field_skip').length,
      totalExitIntents: frictionEvents.filter(e => e.eventType === 'exit_intent').length,
      sessionsWithFriction: new Set(frictionEvents.map(e => e.sessionId)).size,
      frictionRate: Number(sessionCount.count) > 0 
        ? Math.round((new Set(frictionEvents.map(e => e.sessionId)).size / Number(sessionCount.count)) * 100) 
        : 0
    };

    // Generate AI report if requested
    let aiReport = null;
    if (generateReport && frictionEvents.length > 0) {
      aiReport = await generateFrictionReport({
        period,
        overallStats,
        frictionByPage: frictionByPage.slice(0, 10),
        formFriction: formFriction.slice(0, 5),
        recentEvents: frictionEvents.slice(0, 50) as FrictionEvent[]
      });
    }

    return NextResponse.json({
      period,
      dateRange: { start, end: now },
      overallStats,
      frictionByPage: frictionByPage.slice(0, 20),
      formFriction: formFriction.slice(0, 10),
      recentEvents: frictionEvents.slice(0, 100),
      aiReport
    });
  } catch (error) {
    console.error('Error fetching friction data:', error);
    return NextResponse.json({ error: 'Failed to fetch friction data' }, { status: 500 });
  }
}

function aggregateFrictionByPage(events: FrictionEvent[], totalSessions: number): FrictionByPage[] {
  const pageMap = new Map<string, {
    rageClicks: number;
    deadClicks: number;
    mouseThrashes: number;
    formAbandonments: number;
    fieldSkips: number;
    sessions: Set<string>;
    issues: Map<string, { count: number; element?: string; details?: string }>;
  }>();

  for (const event of events) {
    if (!pageMap.has(event.path)) {
      pageMap.set(event.path, {
        rageClicks: 0,
        deadClicks: 0,
        mouseThrashes: 0,
        formAbandonments: 0,
        fieldSkips: 0,
        sessions: new Set(),
        issues: new Map()
      });
    }

    const page = pageMap.get(event.path)!;
    page.sessions.add(event.sessionId);
    const data = event.eventData as Record<string, unknown> | null;

    switch (event.eventType) {
      case 'rage_click':
        page.rageClicks++;
        const rageElement = String(data?.element || data?.elementPath || 'unknown');
        const rageKey = `rage:${rageElement}`;
        const existing = page.issues.get(rageKey) || { count: 0, element: rageElement };
        existing.count++;
        page.issues.set(rageKey, existing);
        break;

      case 'dead_click':
        page.deadClicks++;
        const deadElement = String(data?.element || data?.elementPath || 'unknown');
        const deadKey = `dead:${deadElement}`;
        const deadExisting = page.issues.get(deadKey) || { count: 0, element: deadElement };
        deadExisting.count++;
        page.issues.set(deadKey, deadExisting);
        break;

      case 'mouse_thrash':
        page.mouseThrashes++;
        break;

      case 'form_abandonment':
        page.formAbandonments++;
        const lastField = String(data?.lastFieldInteracted || 'unknown');
        const formKey = `form_abandon:${lastField}`;
        const formExisting = page.issues.get(formKey) || { 
          count: 0, 
          element: lastField,
          details: `Form abandoned at ${lastField}`
        };
        formExisting.count++;
        page.issues.set(formKey, formExisting);
        break;

      case 'form_field_skip':
        page.fieldSkips++;
        break;
    }
  }

  const results: FrictionByPage[] = [];
  
  for (const [path, data] of pageMap.entries()) {
    const totalFriction = data.rageClicks + data.deadClicks + data.mouseThrashes + 
                          data.formAbandonments + data.fieldSkips;
    
    // Calculate friction score (weighted)
    const frictionScore = (
      data.rageClicks * 3 +      // Rage clicks are severe
      data.deadClicks * 2 +      // Dead clicks are moderate
      data.mouseThrashes * 2 +   // Mouse thrashing is moderate
      data.formAbandonments * 4 + // Form abandonment is very severe
      data.fieldSkips * 1         // Field skips are minor
    ) / Math.max(data.sessions.size, 1);

    // Get top issues
    const topIssues = Array.from(data.issues.entries())
      .map(([key, value]) => ({
        type: key.split(':')[0],
        element: value.element,
        count: value.count,
        details: value.details
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    results.push({
      path,
      rageClicks: data.rageClicks,
      deadClicks: data.deadClicks,
      mouseThrashes: data.mouseThrashes,
      formAbandonments: data.formAbandonments,
      fieldSkips: data.fieldSkips,
      totalFriction,
      frictionScore: Math.round(frictionScore * 10) / 10,
      sessions: data.sessions.size,
      topIssues
    });
  }

  return results.sort((a, b) => b.frictionScore - a.frictionScore);
}

function analyzeFormFriction(events: FrictionEvent[]): FormFriction[] {
  const formMap = new Map<string, {
    path: string;
    abandonments: number;
    completions: number;
    fieldProblems: Map<string, { label: string | null; skips: number; abandonedAt: number }>;
  }>();

  const formAbandonments = events.filter(e => e.eventType === 'form_abandonment');
  const fieldSkips = events.filter(e => e.eventType === 'form_field_skip');

  for (const event of formAbandonments) {
    const data = event.eventData as Record<string, unknown> | null;
    const formKey = String(data?.formId || data?.formName || event.path);
    
    if (!formMap.has(formKey)) {
      formMap.set(formKey, {
        path: event.path,
        abandonments: 0,
        completions: 0,
        fieldProblems: new Map()
      });
    }
    
    const form = formMap.get(formKey)!;
    form.abandonments++;
    
    const lastField = String(data?.lastFieldInteracted || 'unknown');
    const fieldData = form.fieldProblems.get(lastField) || { label: null, skips: 0, abandonedAt: 0 };
    fieldData.abandonedAt++;
    form.fieldProblems.set(lastField, fieldData);
  }

  for (const event of fieldSkips) {
    const data = event.eventData as Record<string, unknown> | null;
    const formKey = String(data?.formId || data?.formName || event.path);
    
    if (!formMap.has(formKey)) {
      formMap.set(formKey, {
        path: event.path,
        abandonments: 0,
        completions: 0,
        fieldProblems: new Map()
      });
    }
    
    const form = formMap.get(formKey)!;
    const fieldName = String(data?.fieldName || 'unknown');
    const fieldLabel = data?.fieldLabel ? String(data.fieldLabel) : null;
    const fieldData = form.fieldProblems.get(fieldName) || { label: fieldLabel, skips: 0, abandonedAt: 0 };
    fieldData.skips++;
    if (fieldLabel) fieldData.label = fieldLabel;
    form.fieldProblems.set(fieldName, fieldData);
  }

  const results: FormFriction[] = [];
  
  for (const [formKey, data] of formMap.entries()) {
    const problemFields = Array.from(data.fieldProblems.entries())
      .map(([name, info]) => ({
        fieldName: name,
        fieldLabel: info.label,
        skips: info.skips,
        abandonedAt: info.abandonedAt
      }))
      .sort((a, b) => (b.skips + b.abandonedAt * 3) - (a.skips + a.abandonedAt * 3))
      .slice(0, 5);

    results.push({
      formId: formKey.includes('/') ? null : formKey,
      formName: formKey.includes('/') ? null : formKey,
      path: data.path,
      abandonments: data.abandonments,
      completions: data.completions,
      abandonmentRate: data.abandonments > 0 ? 100 : 0, // Would need form_submit events to calculate properly
      problemFields
    });
  }

  return results.sort((a, b) => b.abandonments - a.abandonments);
}

async function generateFrictionReport(data: {
  period: string;
  overallStats: Record<string, number>;
  frictionByPage: FrictionByPage[];
  formFriction: FormFriction[];
  recentEvents: FrictionEvent[];
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { error: 'AI analysis unavailable', source: 'fallback' };
  }

  const prompt = `You are a UX analyst generating a friction report for a website. Analyze the following data and provide actionable insights.

PERIOD: Last ${data.period === '7d' ? '7 days' : data.period === '30d' ? '30 days' : '90 days'}

OVERALL FRICTION STATS:
- Total Sessions: ${data.overallStats.totalSessions}
- Sessions with Friction: ${data.overallStats.sessionsWithFriction} (${data.overallStats.frictionRate}%)
- Rage Clicks: ${data.overallStats.totalRageClicks}
- Dead Clicks: ${data.overallStats.totalDeadClicks}
- Mouse Thrashing Events: ${data.overallStats.totalMouseThrashes}
- Form Abandonments: ${data.overallStats.totalFormAbandonments}
- Form Field Skips: ${data.overallStats.totalFieldSkips}
- Exit Intents: ${data.overallStats.totalExitIntents}

TOP FRICTION PAGES:
${data.frictionByPage.map((p, i) => `${i + 1}. ${p.path}
   - Friction Score: ${p.frictionScore}
   - Rage Clicks: ${p.rageClicks}, Dead Clicks: ${p.deadClicks}
   - Form Issues: ${p.formAbandonments} abandonments, ${p.fieldSkips} field skips
   - Top Issues: ${p.topIssues.map(issue => `${issue.type} on "${issue.element}" (${issue.count}x)`).join(', ') || 'None specific'}`).join('\n\n')}

FORM FRICTION:
${data.formFriction.map((f, i) => `${i + 1}. Form on ${f.path}
   - Abandonments: ${f.abandonments}
   - Problem Fields: ${f.problemFields.map(pf => `"${pf.fieldLabel || pf.fieldName}" (${pf.skips} skips, ${pf.abandonedAt} abandoned here)`).join(', ') || 'None specific'}`).join('\n\n')}

Based on this data, provide a comprehensive friction report in JSON format:

{
  "summary": "2-3 sentence executive summary of the friction situation",
  "frictionLevel": "low|medium|high|critical",
  "keyFindings": [
    {
      "finding": "Specific finding",
      "severity": "critical|high|medium|low",
      "evidence": "What data supports this",
      "impact": "How this affects users/business"
    }
  ],
  "topProblems": [
    {
      "problem": "Specific problem description",
      "location": "Where it occurs (page/element)",
      "frequency": "How often",
      "recommendation": "Specific action to fix"
    }
  ],
  "formIssues": [
    {
      "form": "Which form",
      "issue": "What's wrong",
      "problemField": "Which field is problematic",
      "recommendation": "How to fix"
    }
  ],
  "prioritizedActions": [
    {
      "priority": 1,
      "action": "Specific action to take",
      "effort": "low|medium|high",
      "impact": "low|medium|high",
      "rationale": "Why this should be done first"
    }
  ],
  "trendsAndPatterns": [
    "Pattern or trend observed"
  ]
}

Focus on actionable insights. Be specific about elements and pages. Prioritize by business impact.
Return ONLY the JSON object.`;

  try {
    const anthropic = new Anthropic({ apiKey });
    
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
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
    console.error('Error generating friction report:', error);
    return { error: 'AI analysis failed', source: 'fallback' };
  }
}
