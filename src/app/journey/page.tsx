'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface Stage {
  id: string;
  name: string;
  description: string;
  emotion: string;
  emotionScore: number;
  touchpoints: string[];
  userActions: string[];
  userThoughts: string[];
  painPoints: string[];
  opportunities: string[];
  metrics: {
    sessionsReaching: number;
    avgTimeSeconds: number;
    dropOffRate: number;
  };
  frictionLevel: 'none' | 'low' | 'medium' | 'high';
}

interface JourneyMap {
  id: string;
  siteId: string;
  period: string;
  stages: Stage[];
  summary: {
    overallNarrative: string;
    criticalMoment: string;
    biggestDropOff: { location: string; rate: number; reason: string; fix: string };
    topOpportunity: string;
    journeyHealthScore: number;
  };
  generatedAt: string;
}

interface Site {
  id: string;
  name: string;
  domain: string;
}

const EMOTION_CONFIG: Record<string, { emoji: string; label: string; color: string; bg: string }> = {
  curious:    { emoji: '🔍', label: 'Curious',    color: 'text-blue-600',   bg: 'bg-blue-50' },
  excited:    { emoji: '✨', label: 'Excited',    color: 'text-purple-600', bg: 'bg-purple-50' },
  hopeful:    { emoji: '🌟', label: 'Hopeful',    color: 'text-indigo-600', bg: 'bg-indigo-50' },
  engaged:    { emoji: '👁️',  label: 'Engaged',    color: 'text-green-600',  bg: 'bg-green-50' },
  satisfied:  { emoji: '😊', label: 'Satisfied',  color: 'text-green-600',  bg: 'bg-green-50' },
  uncertain:  { emoji: '🤔', label: 'Uncertain',  color: 'text-amber-600',  bg: 'bg-amber-50' },
  confused:   { emoji: '😕', label: 'Confused',   color: 'text-orange-600', bg: 'bg-orange-50' },
  frustrated: { emoji: '😤', label: 'Frustrated', color: 'text-red-600',    bg: 'bg-red-50' },
};

const FRICTION_COLORS: Record<string, string> = {
  none:   'border-green-300',
  low:    'border-amber-300',
  medium: 'border-orange-400',
  high:   'border-red-500',
};

function formatTime(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function dropOffColor(rate: number) {
  if (rate < 30) return 'text-green-600';
  if (rate < 60) return 'text-amber-600';
  return 'text-red-600';
}

function healthScoreColor(score: number) {
  if (score >= 70) return { text: 'text-green-600', bg: 'bg-green-100', ring: 'ring-green-400' };
  if (score >= 40) return { text: 'text-amber-600', bg: 'bg-amber-100', ring: 'ring-amber-400' };
  return { text: 'text-red-600', bg: 'bg-red-100', ring: 'ring-red-400' };
}

function EmotionCurve({ stages }: { stages: Stage[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const width = 800;
  const height = 100;
  const padding = { x: 40, y: 16 };

  if (stages.length < 2) return null;

  const plotWidth = width - padding.x * 2;
  const plotHeight = height - padding.y * 2;

  const points = stages.map((stage, i) => ({
    x: padding.x + (i / (stages.length - 1)) * plotWidth,
    y: padding.y + plotHeight - (stage.emotionScore / 10) * plotHeight,
    score: stage.emotionScore,
    name: stage.name,
  }));

  // Cubic bezier smooth path
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cp1x = p0.x + (p1.x - p0.x) / 3;
    const cp2x = p1.x - (p1.x - p0.x) / 3;
    d += ` C ${cp1x},${p0.y} ${cp2x},${p1.y} ${p1.x},${p1.y}`;
  }

  // Gradient fill area
  const fillD = d + ` L ${points[points.length - 1].x},${height} L ${points[0].x},${height} Z`;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
      <p className="text-sm font-medium text-slate-700 mb-4">Emotional Journey</p>
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          style={{ height: 100 }}
        >
          <defs>
            <linearGradient id="emotionGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Gridlines */}
          {[0, 5, 10].map(v => {
            const y = padding.y + plotHeight - (v / 10) * plotHeight;
            return (
              <g key={v}>
                <line x1={padding.x} y1={y} x2={width - padding.x} y2={y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4,4" />
                <text x={padding.x - 6} y={y + 4} fontSize="9" fill="#94a3b8" textAnchor="end">{v}</text>
              </g>
            );
          })}
          {/* Fill */}
          <path d={fillD} fill="url(#emotionGrad)" />
          {/* Line */}
          <path d={d} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {/* Dots + labels */}
          {points.map((p, i) => {
            const color = p.score >= 7 ? '#16a34a' : p.score >= 4 ? '#6366f1' : '#dc2626';
            return (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="5" fill="white" stroke={color} strokeWidth="2.5" />
                <text x={p.x} y={height - 2} fontSize="9" fill="#64748b" textAnchor="middle">{p.name}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Positive (7–10)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" /> Neutral (4–6)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Negative (0–3)</span>
      </div>
    </div>
  );
}

export default function JourneyPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  const [period, setPeriod] = useState('30d');
  const [journeyMap, setJourneyMap] = useState<JourneyMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [activeStage, setActiveStage] = useState<string | null>(null);

  useEffect(() => {
    fetchSites();
  }, []);

  useEffect(() => {
    if (selectedSite) {
      fetchJourneyMap();
    }
  }, [selectedSite, period]);

  const fetchSites = async () => {
    try {
      const res = await fetch('/api/sites');
      const data = await res.json();
      setSites(data.sites || []);
      if (data.sites?.length > 0) setSelectedSite(data.sites[0].id);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const fetchJourneyMap = async () => {
    if (!selectedSite) return;
    setError('');
    try {
      const res = await fetch(`/api/journey?siteId=${selectedSite}&period=${period}`);
      const data = await res.json();
      setJourneyMap(data.map || null);
      setActiveStage(null);
    } catch (e) { console.error(e); }
  };

  const generateJourneyMap = async () => {
    if (!selectedSite) return;
    setGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/journey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: selectedSite, period }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Generation failed');
      } else {
        setJourneyMap(data.map);
        setActiveStage(null);
      }
    } catch (e) {
      console.error(e);
      setError('Something went wrong. Please try again.');
    }
    setGenerating(false);
  };

  const currentSite = sites.find(s => s.id === selectedSite);
  const stages: Stage[] = (journeyMap?.stages as Stage[]) || [];
  const summary = journeyMap?.summary;
  const healthColors = summary ? healthScoreColor(summary.journeyHealthScore) : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <span className="font-semibold text-xl text-slate-900">Behavioral Insights</span>
              </Link>
              {sites.length > 0 && (
                <select
                  value={selectedSite || ''}
                  onChange={(e) => setSelectedSite(e.target.value)}
                  className="ml-4 border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white text-slate-900"
                >
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
            </div>
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-slate-600 hover:text-slate-900 font-medium text-sm">Dashboard</Link>
              <Link href="/flows" className="text-slate-600 hover:text-slate-900 font-medium text-sm">User Flows</Link>
              <Link href="/friction" className="text-slate-600 hover:text-slate-900 font-medium text-sm">Patterns</Link>
              <Link href="/journey" className="text-indigo-600 font-medium text-sm">Journey Map</Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Customer Journey Map</h1>
            {currentSite && (
              <p className="text-sm text-slate-500 mt-0.5">{currentSite.domain}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {['7d', '30d', '90d'].map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${period === p ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'}`}
                >
                  {p === '7d' ? '7 days' : p === '30d' ? '30 days' : '90 days'}
                </button>
              ))}
            </div>
            <button
              onClick={generateJourneyMap}
              disabled={generating || !selectedSite}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              {generating ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {journeyMap ? 'Regenerate' : 'Generate Journey Map'}
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Empty state */}
        {!journeyMap && !generating && (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Generate your first journey map</h2>
            <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
              AI will analyze your session data, navigation patterns, and friction points to map out how users actually move through your site.
            </p>
            <button
              onClick={generateJourneyMap}
              disabled={!selectedSite}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg font-medium"
            >
              Generate Journey Map
            </button>
          </div>
        )}

        {/* Generating skeleton */}
        {generating && (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-600 font-medium">Analyzing your analytics data...</p>
            <p className="text-slate-400 text-sm mt-1">This usually takes 10–20 seconds</p>
          </div>
        )}

        {/* Journey map */}
        {journeyMap && !generating && stages.length > 0 && (
          <>
            {/* Health score + generated timestamp */}
            <div className="flex items-center gap-3 mb-6">
              {summary && healthColors && (
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${healthColors.bg} ring-1 ${healthColors.ring}`}>
                  <span className={`text-sm font-semibold ${healthColors.text}`}>Journey Health</span>
                  <span className={`text-lg font-bold ${healthColors.text}`}>{summary.journeyHealthScore}/100</span>
                </div>
              )}
              <span className="text-xs text-slate-400">
                Generated {new Date(journeyMap.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {/* Stage cards */}
            <div className="overflow-x-auto pb-4 mb-6">
              <div className="flex gap-0 min-w-max">
                {stages.map((stage, idx) => {
                  const emotion = EMOTION_CONFIG[stage.emotion] || EMOTION_CONFIG.uncertain;
                  const isActive = activeStage === stage.id;
                  const isLast = idx === stages.length - 1;

                  return (
                    <div key={stage.id} className="flex items-start">
                      {/* Stage card */}
                      <div
                        onClick={() => setActiveStage(isActive ? null : stage.id)}
                        className={`w-64 rounded-xl border-2 cursor-pointer transition-all ${
                          isActive ? 'border-indigo-500 shadow-lg shadow-indigo-100' : FRICTION_COLORS[stage.frictionLevel]
                        } bg-white`}
                      >
                        {/* Card header */}
                        <div className="p-4 border-b border-slate-100">
                          <div className="flex items-start justify-between mb-2">
                            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Stage {idx + 1}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${emotion.bg} ${emotion.color}`}>
                              {emotion.emoji} {emotion.label}
                            </span>
                          </div>
                          <h3 className="font-semibold text-slate-900 text-base">{stage.name}</h3>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{stage.description}</p>
                        </div>

                        {/* Metrics */}
                        <div className="px-4 py-3 grid grid-cols-3 gap-2 border-b border-slate-100">
                          <div className="text-center">
                            <p className="text-xs text-slate-400">Sessions</p>
                            <p className="text-sm font-semibold text-slate-900">{stage.metrics.sessionsReaching.toLocaleString()}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-slate-400">Avg time</p>
                            <p className="text-sm font-semibold text-slate-900">{formatTime(stage.metrics.avgTimeSeconds)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-slate-400">Drop-off</p>
                            <p className={`text-sm font-semibold ${dropOffColor(stage.metrics.dropOffRate)}`}>
                              {stage.metrics.dropOffRate}%
                            </p>
                          </div>
                        </div>

                        {/* Pages */}
                        <div className="px-4 py-3 border-b border-slate-100">
                          <p className="text-xs font-medium text-slate-500 mb-1.5">Touchpoints</p>
                          <div className="flex flex-wrap gap-1">
                            {stage.touchpoints.slice(0, 3).map(page => (
                              <span key={page} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono truncate max-w-full">
                                {page}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Pain points */}
                        {stage.painPoints.length > 0 && (
                          <div className="px-4 py-3 border-b border-slate-100">
                            <p className="text-xs font-medium text-red-600 mb-1.5">Pain points</p>
                            <ul className="space-y-1">
                              {stage.painPoints.slice(0, 2).map((p, i) => (
                                <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                                  <span className="text-red-400 mt-0.5 shrink-0">▸</span>{p}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Expanded detail */}
                        {isActive && (
                          <div className="px-4 py-3 space-y-3 bg-slate-50 rounded-b-xl">
                            {stage.userActions.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-slate-500 mb-1">What users do</p>
                                <ul className="space-y-0.5">
                                  {stage.userActions.map((a, i) => (
                                    <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                                      <span className="text-indigo-400 mt-0.5 shrink-0">▸</span>{a}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {stage.userThoughts.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-slate-500 mb-1">What they&apos;re thinking</p>
                                <ul className="space-y-0.5">
                                  {stage.userThoughts.map((t, i) => (
                                    <li key={i} className="text-xs text-slate-500 italic">&ldquo;{t}&rdquo;</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {stage.opportunities.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-green-600 mb-1">Opportunities</p>
                                <ul className="space-y-0.5">
                                  {stage.opportunities.map((o, i) => (
                                    <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                                      <span className="text-green-500 mt-0.5 shrink-0">✦</span>{o}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Expand hint */}
                        <div className="px-4 py-2 text-center">
                          <span className="text-xs text-slate-400">{isActive ? '▲ less' : '▼ more'}</span>
                        </div>
                      </div>

                      {/* Connector arrow */}
                      {!isLast && (
                        <div className="flex flex-col items-center justify-center self-center mx-2 shrink-0">
                          <span className={`text-xs font-medium mb-1 ${dropOffColor(stage.metrics.dropOffRate)}`}>
                            -{stage.metrics.dropOffRate}%
                          </span>
                          <svg className="w-8 h-4 text-slate-300" fill="none" viewBox="0 0 32 16">
                            <path d="M0 8 H26 M22 2 L30 8 L22 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Emotion curve */}
            <EmotionCurve stages={stages} />

            {/* Summary insights */}
            {summary && (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Journey narrative</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{summary.overallNarrative}</p>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Critical moment</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{summary.criticalMoment}</p>
                </div>

                {summary.biggestDropOff && (
                  <div className="bg-red-50 rounded-xl border border-red-200 p-5">
                    <p className="text-xs font-medium text-red-500 uppercase tracking-wide mb-2">Biggest drop-off</p>
                    <p className="text-sm font-semibold text-red-800 mb-1">
                      {summary.biggestDropOff.location} — {summary.biggestDropOff.rate}% leave here
                    </p>
                    <p className="text-sm text-red-700 mb-2">{summary.biggestDropOff.reason}</p>
                    <p className="text-xs text-red-600 font-medium">Fix: {summary.biggestDropOff.fix}</p>
                  </div>
                )}

                <div className="bg-green-50 rounded-xl border border-green-200 p-5">
                  <p className="text-xs font-medium text-green-600 uppercase tracking-wide mb-2">Top opportunity</p>
                  <p className="text-sm text-green-800 leading-relaxed">{summary.topOpportunity}</p>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
