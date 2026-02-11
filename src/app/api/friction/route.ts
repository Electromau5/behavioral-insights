import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { events } from '@/lib/schema';
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
        sql`${events.eventType} IN ('rage_click', 'dead_click', 'mouse_thrash', 'form_abandonment', 'form_field_skip', 'form_start', 'exit_intent')`
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
    
    const frictionScore = (
      data.rageClicks * 3 +
      data.deadClicks * 2 +
      data.mouseThrashes * 2 +
      data.formAbandonments * 4 +
      data.fieldSkips * 1
    ) / Math.max(data.sessions.size, 1);

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
      abandonmentRate: data.abandonments > 0 ? 100 : 0,
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

  const prompt = `You are an expert UX researcher and behavioral psychologist analyzing website friction data. Your goal is to explain WHY users are experiencing friction using established UX research frameworks, not just describe WHAT is happening.

=== UX RESEARCH FRAMEWORK ===

BEHAVIORAL PSYCHOLOGY PRINCIPLES:
1. Paradox of Choice: Too many options lead to decision fatigue and reduced satisfaction. Users may freeze, abandon, or make poor choices.
2. Zeigarnik Effect: Users remember uncompleted tasks better than completed ones. Interrupted flows create mental tension.
3. Serial Position Effect: Users remember first and last items in lists better than middle items. Navigation/menu issues often occur in middle items.
4. Peak-End Rule: Users judge experiences by their peak (best/worst) moment and the ending. Bad endings disproportionately hurt perception.
5. Endowment Effect: Users overvalue things they've invested time in. Form abandonment after significant input is especially frustrating.

DESIGN LAWS:
1. Fitts's Law: Time to click a target depends on distance and size. Small/distant buttons cause errors and rage clicks.
2. Hick's Law: Decision time increases with number and complexity of choices. Too many options cause hesitation and mouse thrashing.
3. Miller's Law (7±2): Working memory holds 5-9 items. Information overload causes confusion and errors.

KEY UX CONCEPTS:
1. Mental Models: Users' internal understanding of how systems work. Friction often = violated mental model (expected X, got Y).
2. Affordance: Visual cues suggesting how to use an element. Dead clicks = missing or misleading affordance.
3. Cognitive Load: Mental effort required. Mouse thrashing and hesitation indicate high cognitive load.
4. Progressive Disclosure: Revealing info gradually. Form abandonment may indicate too much revealed at once.
5. Visual Hierarchy: Guiding attention by importance. Rage clicks on wrong elements = poor visual hierarchy.
6. Information Architecture: How content is organized. Navigation confusion = poor IA.

FRICTION SIGNAL INTERPRETATIONS:
- Rage Clicks: Violated expectations. User expected action but nothing happened. Causes: slow response, broken element, misleading affordance, element too small (Fitts's Law).
- Dead Clicks: Misleading affordance. Element looks clickable but isn't. User's mental model says "this should work."
- Mouse Thrashing: High cognitive load. User is confused, searching, or frustrated. May indicate: unclear IA, Paradox of Choice, violated mental model.
- Form Abandonment: Friction exceeded motivation. Endowment Effect lost. Causes: too many fields (Miller's Law), unclear value, privacy concerns, confusing labels.
- Form Field Skip: Field creates friction. Causes: unclear label, feels unnecessary, too personal, cognitive load spike.
- Exit Intent: User considering leaving. Peak-End Rule opportunity - this is the "end" of their experience.

=== FRICTION DATA TO ANALYZE ===

PERIOD: Last ${data.period === '7d' ? '7 days' : data.period === '30d' ? '30 days' : '90 days'}

OVERALL STATS:
- Total Sessions: ${data.overallStats.totalSessions}
- Sessions with Friction: ${data.overallStats.sessionsWithFriction} (${data.overallStats.frictionRate}%)
- Rage Clicks: ${data.overallStats.totalRageClicks}
- Dead Clicks: ${data.overallStats.totalDeadClicks}
- Mouse Thrashing: ${data.overallStats.totalMouseThrashes}
- Form Abandonments: ${data.overallStats.totalFormAbandonments}
- Form Field Skips: ${data.overallStats.totalFieldSkips}
- Exit Intents: ${data.overallStats.totalExitIntents}

TOP FRICTION PAGES:
${data.frictionByPage.map((p, i) => `${i + 1}. ${p.path}
   - Score: ${p.frictionScore} | Sessions: ${p.sessions}
   - Rage: ${p.rageClicks}, Dead: ${p.deadClicks}, Thrash: ${p.mouseThrashes}
   - Form: ${p.formAbandonments} abandons, ${p.fieldSkips} skips
   - Issues: ${p.topIssues.map(issue => `${issue.type} on "${issue.element}" (${issue.count}x)`).join(', ') || 'None'}`).join('\n\n')}

FORM FRICTION:
${data.formFriction.map((f, i) => `${i + 1}. Form on ${f.path}
   - Abandonments: ${f.abandonments}
   - Problem Fields: ${f.problemFields.map(pf => `"${pf.fieldLabel || pf.fieldName}" (${pf.skips} skips, ${pf.abandonedAt} abandoned here)`).join(', ') || 'None'}`).join('\n\n')}

=== OUTPUT FORMAT ===

Return a JSON object with psychological insights:

{
  "summary": "2-3 sentence executive summary explaining friction patterns and their psychological roots",
  "frictionLevel": "low|medium|high|critical",
  "userExperience": {
    "emotionalState": "How users likely feel (frustrated, confused, anxious, etc.)",
    "mentalModelViolations": ["List of ways the site violates user expectations"],
    "cognitiveLoadAssessment": "low|moderate|high|overwhelming"
  },
  "keyFindings": [
    {
      "finding": "Specific finding",
      "severity": "critical|high|medium|low",
      "evidence": "Data supporting this",
      "psychologicalCause": "UX principle explaining WHY (e.g., 'Fitts's Law violation - button too small')",
      "userMindset": "What the user is thinking/feeling when this happens",
      "impact": "Business and user impact"
    }
  ],
  "topProblems": [
    {
      "problem": "Specific problem",
      "location": "Page/element",
      "frequency": "How often",
      "rootCause": "Psychological/UX root cause",
      "userThinking": "What users expect vs what happens",
      "recommendation": "Specific fix grounded in UX principles"
    }
  ],
  "formIssues": [
    {
      "form": "Which form",
      "issue": "What's wrong",
      "problemField": "Which field",
      "psychologicalBarrier": "Why users struggle (privacy, cognitive load, unclear value, etc.)",
      "recommendation": "Fix based on form UX best practices"
    }
  ],
  "uxPatterns": [
    {
      "pattern": "Named UX pattern (e.g., 'Decision Paralysis', 'Affordance Confusion', 'Cognitive Overload')",
      "principle": "UX law/principle that explains it",
      "evidence": "What data shows this",
      "userExperience": "How this feels to users",
      "solution": "How to address it"
    }
  ],
  "prioritizedActions": [
    {
      "priority": 1,
      "action": "Specific action",
      "effort": "low|medium|high",
      "impact": "low|medium|high",
      "psychologicalRationale": "Why this matters for user psychology",
      "expectedOutcome": "What should improve"
    }
  ],
  "peakEndAnalysis": {
    "currentPeakMoments": "What are the worst friction peaks",
    "endingExperience": "How do sessions typically end",
    "recommendations": "How to improve peaks and endings per Peak-End Rule"
  }
}

Focus on EXPLAINING user psychology, not just describing data. Reference specific UX principles. Be actionable and specific.
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
    console.error('Error generating friction report:', error);
    return { error: 'AI analysis failed', source: 'fallback' };
  }
}
