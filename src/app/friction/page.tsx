'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Site {
  id: string;
  name: string;
  domain: string;
}

interface SessionMetrics {
  totalSessions: number;
  avgDuration: number;
  avgPageViews: number;
  avgClicks: number;
  avgScrollDepth: number;
  bounceRate: number;
  bounceCount: number;
}

interface EngagementPatterns {
  scrollDistribution: {
    shallow: number;
    partial: number;
    good: number;
    deep: number;
  };
  durationDistribution: {
    veryShort: number;
    short: number;
    medium: number;
    long: number;
  };
  topPages: Array<{
    path: string;
    views: number;
    avgTimeOnPage: number;
  }>;
}

interface NavigationPatterns {
  topEntryPages: Array<{
    page: string;
    count: number;
    percentage: number;
  }>;
  topExitPages: Array<{
    page: string;
    count: number;
    exitRate: number;
  }>;
}

interface FrictionPatterns {
  counts: {
    rageClicks: number;
    deadClicks: number;
    mouseThrashes: number;
    formAbandonments: number;
    fieldSkips: number;
    exitIntents: number;
  };
  sessionsWithFriction: number;
  frictionRate: number;
  topFrictionPages: Array<{
    page: string;
    total: number;
    types: Record<string, number>;
  }>;
}

interface DevicePattern {
  device: string;
  sessions: number;
  avgDuration: number;
  avgScrollDepth: number;
  bounceRate: number;
}

interface RedFlag {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  metric: string;
  value: number;
  threshold: number;
  message: string;
}

interface BehavioralPattern {
  pattern: string;
  description: string;
  frequency: string;
  interpretation: string;
  implication: string;
}

interface UsabilityIssue {
  issue: string;
  evidence: string;
  affectedUsers: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  recommendation: string;
}

interface RedFlagAnalysis {
  flag: string;
  rootCause: string;
  businessImpact: string;
  urgency: string;
  actionPlan: string;
}

interface PrioritizedRecommendation {
  priority: number;
  recommendation: string;
  expectedImpact: string;
  effort: 'low' | 'medium' | 'high';
}

interface AIReport {
  executiveSummary: string;
  behavioralPatterns: BehavioralPattern[];
  siteInterpretation: {
    contentEffectiveness: string;
    navigationClarity: string;
    conversionReadiness: string;
    overallExperience: string;
  };
  usabilityIssues: UsabilityIssue[];
  collectiveMindset: {
    dominantStates: string[];
    frustrationLevel: string;
    intentClarity: string;
    satisfactionIndicators: string;
  };
  redFlagAnalysis: RedFlagAnalysis[];
  prioritizedRecommendations: PrioritizedRecommendation[];
  source?: string;
  error?: string;
}

interface PatternsData {
  period: string;
  dateRange: { start: string; end: string };
  siteHealthScore: number;
  sessionMetrics: SessionMetrics;
  engagementPatterns: EngagementPatterns;
  navigationPatterns: NavigationPatterns;
  frictionPatterns: FrictionPatterns;
  devicePatterns: DevicePattern[];
  redFlags: RedFlag[];
  aiReport: AIReport | null;
}

export default function PatternsPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  const [patternsData, setPatternsData] = useState<PatternsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [period, setPeriod] = useState('7d');
  const [activeTab, setActiveTab] = useState<'patterns' | 'issues' | 'mindset' | 'redflags'>('patterns');

  useEffect(() => {
    fetchSites();
  }, []);

  useEffect(() => {
    if (selectedSite) {
      fetchPatternsData(false);
    }
  }, [selectedSite, period]);

  const fetchSites = async () => {
    try {
      const res = await fetch('/api/sites');
      const data = await res.json();
      setSites(data.sites || []);
      if (data.sites?.length > 0) {
        setSelectedSite(data.sites[0].id);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const fetchPatternsData = async (generateReport: boolean) => {
    if (!selectedSite) return;
    if (generateReport) setGenerating(true);
    else setLoading(true);

    try {
      const res = await fetch(`/api/patterns?siteId=${selectedSite}&period=${period}&generateReport=${generateReport}`);
      const data = await res.json();
      setPatternsData(data);
      if (generateReport && data.aiReport) {
        setActiveTab('patterns');
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
    setGenerating(false);
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 bg-emerald-100 border-emerald-200';
    if (score >= 60) return 'text-amber-600 bg-amber-100 border-amber-200';
    if (score >= 40) return 'text-orange-600 bg-orange-100 border-orange-200';
    return 'text-red-600 bg-red-100 border-red-200';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getEffortBadge = (effort: string) => {
    switch (effort) {
      case 'low': return 'bg-emerald-100 text-emerald-700';
      case 'medium': return 'bg-amber-100 text-amber-700';
      case 'high': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  if (loading && sites.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
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
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>{site.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-slate-600 hover:text-slate-900 font-medium text-sm">Dashboard</Link>
              <Link href="/flows" className="text-slate-600 hover:text-slate-900 font-medium text-sm">User Flows</Link>
              <Link href="/friction" className="text-indigo-600 font-medium text-sm">Patterns</Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Behavioral Patterns</h1>
              <p className="text-slate-600 mt-1">Understand how users interact with your site</p>
            </div>
            {patternsData && (
              <div className={`px-4 py-2 rounded-xl border-2 ${getHealthScoreColor(patternsData.siteHealthScore)}`}>
                <div className="text-center">
                  <span className="text-2xl font-bold">{patternsData.siteHealthScore}</span>
                  <span className="text-sm font-medium">/100</span>
                </div>
                <p className="text-xs font-medium">Site Health</p>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {['7d', '30d', '90d'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  period === p
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-slate-600 border border-slate-300'
                }`}
              >
                {p === '7d' ? '7 days' : p === '30d' ? '30 days' : '90 days'}
              </button>
            ))}
          </div>
        </div>

        {patternsData && (
          <>
            {/* Overview Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-sm text-slate-500">Sessions</p>
                <p className="text-2xl font-bold text-slate-900">{patternsData.sessionMetrics.totalSessions}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-sm text-slate-500">Avg Duration</p>
                <p className="text-2xl font-bold text-slate-900">{formatDuration(patternsData.sessionMetrics.avgDuration)}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-sm text-slate-500">Bounce Rate</p>
                <p className={`text-2xl font-bold ${patternsData.sessionMetrics.bounceRate > 50 ? 'text-red-600' : 'text-slate-900'}`}>
                  {patternsData.sessionMetrics.bounceRate}%
                </p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-sm text-slate-500">Avg Scroll Depth</p>
                <p className="text-2xl font-bold text-slate-900">{patternsData.sessionMetrics.avgScrollDepth}%</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-sm text-slate-500">Friction Rate</p>
                <p className={`text-2xl font-bold ${patternsData.frictionPatterns.frictionRate > 15 ? 'text-red-600' : 'text-slate-900'}`}>
                  {patternsData.frictionPatterns.frictionRate}%
                </p>
              </div>
              <div className={`rounded-xl border p-4 ${patternsData.redFlags.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                <p className={`text-sm ${patternsData.redFlags.length > 0 ? 'text-red-600' : 'text-slate-500'}`}>Red Flags</p>
                <p className={`text-2xl font-bold ${patternsData.redFlags.length > 0 ? 'text-red-700' : 'text-slate-900'}`}>
                  {patternsData.redFlags.length}
                </p>
              </div>
            </div>

            {/* Generate Report Button */}
            {!patternsData.aiReport && (
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 mb-8 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">Generate Behavioral Analysis Report</h2>
                    <p className="text-indigo-100 mt-1">AI-powered insights about user patterns, usability issues, and recommendations</p>
                  </div>
                  <button
                    onClick={() => fetchPatternsData(true)}
                    disabled={generating}
                    className="bg-white text-indigo-600 px-6 py-3 rounded-lg font-medium hover:bg-indigo-50 disabled:opacity-50"
                  >
                    {generating ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Analyzing Patterns...
                      </span>
                    ) : (
                      'Generate Report'
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="border-b border-slate-200">
                <div className="flex">
                  {[
                    { id: 'patterns', label: 'Patterns', icon: '📊' },
                    { id: 'issues', label: 'Usability Issues', icon: '⚠️', disabled: !patternsData.aiReport },
                    { id: 'mindset', label: 'User Mindset', icon: '🧠', disabled: !patternsData.aiReport },
                    { id: 'redflags', label: 'Red Flags', icon: '🚨' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => !tab.disabled && setActiveTab(tab.id as typeof activeTab)}
                      disabled={tab.disabled}
                      className={`px-6 py-3 text-sm font-medium border-b-2 flex items-center gap-2 ${
                        activeTab === tab.id
                          ? 'border-indigo-600 text-indigo-600'
                          : tab.disabled
                          ? 'border-transparent text-slate-300 cursor-not-allowed'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <span>{tab.icon}</span>
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-6">
                {activeTab === 'patterns' && (
                  <div className="space-y-8">
                    {/* AI Executive Summary */}
                    {patternsData.aiReport && (
                      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-200">
                        <h3 className="font-semibold text-indigo-900 mb-3">Executive Summary</h3>
                        <p className="text-slate-700">{patternsData.aiReport.executiveSummary}</p>
                      </div>
                    )}

                    {/* AI Behavioral Patterns */}
                    {patternsData.aiReport?.behavioralPatterns && patternsData.aiReport.behavioralPatterns.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-slate-900 mb-4">Detected Behavioral Patterns</h3>
                        <div className="grid md:grid-cols-2 gap-4">
                          {patternsData.aiReport.behavioralPatterns.map((pattern, i) => (
                            <div key={i} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                              <h4 className="font-semibold text-slate-900 mb-2">{pattern.pattern}</h4>
                              <p className="text-sm text-slate-600 mb-2">{pattern.description}</p>
                              <p className="text-xs text-indigo-600 mb-1"><strong>Frequency:</strong> {pattern.frequency}</p>
                              <p className="text-xs text-slate-500 mb-1"><strong>Interpretation:</strong> {pattern.interpretation}</p>
                              <p className="text-xs text-amber-600"><strong>Implication:</strong> {pattern.implication}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Engagement Patterns */}
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-4">Engagement Patterns</h3>
                      <div className="grid md:grid-cols-2 gap-6">
                        {/* Scroll Depth Distribution */}
                        <div className="bg-slate-50 rounded-lg p-4">
                          <h4 className="font-medium text-slate-800 mb-3">Scroll Depth Distribution</h4>
                          <div className="space-y-2">
                            {[
                              { label: 'Deep (75-100%)', value: patternsData.engagementPatterns.scrollDistribution.deep, color: 'bg-emerald-500' },
                              { label: 'Good (50-75%)', value: patternsData.engagementPatterns.scrollDistribution.good, color: 'bg-blue-500' },
                              { label: 'Partial (25-50%)', value: patternsData.engagementPatterns.scrollDistribution.partial, color: 'bg-amber-500' },
                              { label: 'Shallow (0-25%)', value: patternsData.engagementPatterns.scrollDistribution.shallow, color: 'bg-red-500' }
                            ].map((item) => {
                              const total = Object.values(patternsData.engagementPatterns.scrollDistribution).reduce((a, b) => a + b, 0);
                              const percentage = total > 0 ? Math.round((item.value / total) * 100) : 0;
                              return (
                                <div key={item.label}>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span className="text-slate-600">{item.label}</span>
                                    <span className="text-slate-900 font-medium">{item.value} ({percentage}%)</span>
                                  </div>
                                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                    <div className={`h-full ${item.color} rounded-full`} style={{ width: `${percentage}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Session Duration Distribution */}
                        <div className="bg-slate-50 rounded-lg p-4">
                          <h4 className="font-medium text-slate-800 mb-3">Session Duration Distribution</h4>
                          <div className="space-y-2">
                            {[
                              { label: 'Long (>2min)', value: patternsData.engagementPatterns.durationDistribution.long, color: 'bg-emerald-500' },
                              { label: 'Medium (30s-2min)', value: patternsData.engagementPatterns.durationDistribution.medium, color: 'bg-blue-500' },
                              { label: 'Short (10-30s)', value: patternsData.engagementPatterns.durationDistribution.short, color: 'bg-amber-500' },
                              { label: 'Very Short (<10s)', value: patternsData.engagementPatterns.durationDistribution.veryShort, color: 'bg-red-500' }
                            ].map((item) => {
                              const total = Object.values(patternsData.engagementPatterns.durationDistribution).reduce((a, b) => a + b, 0);
                              const percentage = total > 0 ? Math.round((item.value / total) * 100) : 0;
                              return (
                                <div key={item.label}>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span className="text-slate-600">{item.label}</span>
                                    <span className="text-slate-900 font-medium">{item.value} ({percentage}%)</span>
                                  </div>
                                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                    <div className={`h-full ${item.color} rounded-full`} style={{ width: `${percentage}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Navigation Patterns */}
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-4">Navigation Patterns</h3>
                      <div className="grid md:grid-cols-2 gap-6">
                        {/* Entry Pages */}
                        <div className="bg-slate-50 rounded-lg p-4">
                          <h4 className="font-medium text-slate-800 mb-3">Top Entry Pages</h4>
                          <div className="space-y-2">
                            {patternsData.navigationPatterns.topEntryPages.slice(0, 5).map((page, i) => (
                              <div key={i} className="flex justify-between text-sm">
                                <span className="text-slate-600 truncate max-w-[200px]">{page.page}</span>
                                <span className="text-slate-900 font-medium">{page.percentage}%</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Exit Pages */}
                        <div className="bg-slate-50 rounded-lg p-4">
                          <h4 className="font-medium text-slate-800 mb-3">Top Exit Pages</h4>
                          <div className="space-y-2">
                            {patternsData.navigationPatterns.topExitPages.slice(0, 5).map((page, i) => (
                              <div key={i} className="flex justify-between text-sm">
                                <span className="text-slate-600 truncate max-w-[200px]">{page.page}</span>
                                <span className="text-red-600 font-medium">{page.exitRate}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Device Patterns */}
                    {patternsData.devicePatterns.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-slate-900 mb-4">Device Patterns</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-200">
                                <th className="text-left py-3 px-4 font-medium text-slate-600">Device</th>
                                <th className="text-center py-3 px-4 font-medium text-slate-600">Sessions</th>
                                <th className="text-center py-3 px-4 font-medium text-slate-600">Avg Duration</th>
                                <th className="text-center py-3 px-4 font-medium text-slate-600">Avg Scroll</th>
                                <th className="text-center py-3 px-4 font-medium text-slate-600">Bounce Rate</th>
                              </tr>
                            </thead>
                            <tbody>
                              {patternsData.devicePatterns.map((device, i) => (
                                <tr key={i} className="border-b border-slate-100">
                                  <td className="py-3 px-4 font-medium text-slate-900 capitalize">{device.device}</td>
                                  <td className="py-3 px-4 text-center text-slate-600">{device.sessions}</td>
                                  <td className="py-3 px-4 text-center text-slate-600">{formatDuration(device.avgDuration)}</td>
                                  <td className="py-3 px-4 text-center text-slate-600">{device.avgScrollDepth}%</td>
                                  <td className={`py-3 px-4 text-center ${device.bounceRate > 50 ? 'text-red-600' : 'text-slate-600'}`}>
                                    {device.bounceRate}%
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Friction Summary */}
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-4">Friction Signals</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                          <p className="text-xs text-red-600">Rage Clicks</p>
                          <p className="text-xl font-bold text-red-700">{patternsData.frictionPatterns.counts.rageClicks}</p>
                        </div>
                        <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                          <p className="text-xs text-orange-600">Dead Clicks</p>
                          <p className="text-xl font-bold text-orange-700">{patternsData.frictionPatterns.counts.deadClicks}</p>
                        </div>
                        <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                          <p className="text-xs text-amber-600">Mouse Thrash</p>
                          <p className="text-xl font-bold text-amber-700">{patternsData.frictionPatterns.counts.mouseThrashes}</p>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                          <p className="text-xs text-purple-600">Form Abandons</p>
                          <p className="text-xl font-bold text-purple-700">{patternsData.frictionPatterns.counts.formAbandonments}</p>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                          <p className="text-xs text-blue-600">Field Skips</p>
                          <p className="text-xl font-bold text-blue-700">{patternsData.frictionPatterns.counts.fieldSkips}</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                          <p className="text-xs text-slate-600">Exit Intents</p>
                          <p className="text-xl font-bold text-slate-700">{patternsData.frictionPatterns.counts.exitIntents}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'issues' && patternsData.aiReport && (
                  <div className="space-y-6">
                    {/* Site Interpretation */}
                    {patternsData.aiReport.siteInterpretation && (
                      <div className="bg-gradient-to-r from-slate-50 to-indigo-50 rounded-xl p-6 border border-slate-200">
                        <h3 className="font-semibold text-slate-900 mb-4">What Your Patterns Reveal</h3>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="bg-white rounded-lg p-4 border border-slate-200">
                            <h4 className="font-medium text-slate-800 mb-2">Content Effectiveness</h4>
                            <p className="text-sm text-slate-600">{patternsData.aiReport.siteInterpretation.contentEffectiveness}</p>
                          </div>
                          <div className="bg-white rounded-lg p-4 border border-slate-200">
                            <h4 className="font-medium text-slate-800 mb-2">Navigation Clarity</h4>
                            <p className="text-sm text-slate-600">{patternsData.aiReport.siteInterpretation.navigationClarity}</p>
                          </div>
                          <div className="bg-white rounded-lg p-4 border border-slate-200">
                            <h4 className="font-medium text-slate-800 mb-2">Conversion Readiness</h4>
                            <p className="text-sm text-slate-600">{patternsData.aiReport.siteInterpretation.conversionReadiness}</p>
                          </div>
                          <div className="bg-white rounded-lg p-4 border border-slate-200">
                            <h4 className="font-medium text-slate-800 mb-2">Overall Experience</h4>
                            <p className="text-sm text-slate-600">{patternsData.aiReport.siteInterpretation.overallExperience}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Usability Issues */}
                    {patternsData.aiReport.usabilityIssues && patternsData.aiReport.usabilityIssues.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-slate-900 mb-4">Detected Usability Issues</h3>
                        <div className="space-y-4">
                          {patternsData.aiReport.usabilityIssues.map((issue, i) => (
                            <div key={i} className={`rounded-lg p-4 border ${getSeverityColor(issue.severity)}`}>
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${getSeverityColor(issue.severity)}`}>
                                  {issue.severity}
                                </span>
                                <span className="text-xs text-slate-500">Affects {issue.affectedUsers}</span>
                              </div>
                              <p className="font-medium text-slate-900">{issue.issue}</p>
                              <p className="text-sm text-slate-600 mt-1"><strong>Evidence:</strong> {issue.evidence}</p>
                              <p className="text-sm text-emerald-700 mt-2"><strong>Recommendation:</strong> {issue.recommendation}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Prioritized Recommendations */}
                    {patternsData.aiReport.prioritizedRecommendations && patternsData.aiReport.prioritizedRecommendations.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-slate-900 mb-4">Prioritized Recommendations</h3>
                        <div className="space-y-3">
                          {patternsData.aiReport.prioritizedRecommendations.map((rec, i) => (
                            <div key={i} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                                  {rec.priority}
                                </span>
                                <span className="font-medium text-slate-900 flex-1">{rec.recommendation}</span>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${getEffortBadge(rec.effort)}`}>
                                  {rec.effort} effort
                                </span>
                              </div>
                              <p className="text-sm text-slate-600 ml-11">
                                <strong>Expected Impact:</strong> {rec.expectedImpact}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'mindset' && patternsData.aiReport && (
                  <div className="space-y-6">
                    {/* Collective Mindset */}
                    {patternsData.aiReport.collectiveMindset && (
                      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
                        <h3 className="font-semibold text-purple-900 mb-4">Collective User Mindset</h3>
                        <div className="grid md:grid-cols-2 gap-6">
                          <div>
                            <h4 className="font-medium text-purple-800 mb-2">Dominant User States</h4>
                            <div className="flex flex-wrap gap-2">
                              {patternsData.aiReport.collectiveMindset.dominantStates?.map((state, i) => (
                                <span key={i} className="px-3 py-1 bg-white rounded-full text-sm text-purple-700 border border-purple-200">
                                  {state}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <h4 className="font-medium text-purple-800 mb-2">Frustration Level</h4>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                              patternsData.aiReport.collectiveMindset.frustrationLevel === 'critical' ? 'bg-red-100 text-red-700' :
                              patternsData.aiReport.collectiveMindset.frustrationLevel === 'high' ? 'bg-orange-100 text-orange-700' :
                              patternsData.aiReport.collectiveMindset.frustrationLevel === 'moderate' ? 'bg-amber-100 text-amber-700' :
                              'bg-emerald-100 text-emerald-700'
                            }`}>
                              {patternsData.aiReport.collectiveMindset.frustrationLevel}
                            </span>
                          </div>
                        </div>
                        <div className="mt-4 grid md:grid-cols-2 gap-4">
                          <div className="bg-white/60 rounded-lg p-3">
                            <p className="text-xs text-purple-600 uppercase tracking-wide mb-1">Intent Clarity</p>
                            <p className="text-sm text-slate-700">{patternsData.aiReport.collectiveMindset.intentClarity}</p>
                          </div>
                          <div className="bg-white/60 rounded-lg p-3">
                            <p className="text-xs text-purple-600 uppercase tracking-wide mb-1">Satisfaction Indicators</p>
                            <p className="text-sm text-slate-700">{patternsData.aiReport.collectiveMindset.satisfactionIndicators}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Psychological Insights from Red Flags */}
                    {patternsData.aiReport.redFlagAnalysis && patternsData.aiReport.redFlagAnalysis.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-slate-900 mb-4">Behavioral Root Cause Analysis</h3>
                        <div className="space-y-4">
                          {patternsData.aiReport.redFlagAnalysis.map((analysis, i) => (
                            <div key={i} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                              <h4 className="font-medium text-slate-900 mb-2">{analysis.flag}</h4>
                              <div className="grid md:grid-cols-2 gap-4 text-sm">
                                <div>
                                  <p className="text-slate-500">Root Cause</p>
                                  <p className="text-slate-700">{analysis.rootCause}</p>
                                </div>
                                <div>
                                  <p className="text-slate-500">Business Impact</p>
                                  <p className="text-slate-700">{analysis.businessImpact}</p>
                                </div>
                                <div>
                                  <p className="text-slate-500">Urgency</p>
                                  <p className="text-slate-700">{analysis.urgency}</p>
                                </div>
                                <div>
                                  <p className="text-slate-500">Action Plan</p>
                                  <p className="text-emerald-700">{analysis.actionPlan}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'redflags' && (
                  <div className="space-y-6">
                    {patternsData.redFlags.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <span className="text-3xl">✓</span>
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">No Red Flags Detected</h3>
                        <p className="text-slate-600">Your site metrics are within healthy thresholds.</p>
                      </div>
                    ) : (
                      <>
                        <div className="bg-red-50 rounded-xl p-6 border border-red-200">
                          <h3 className="font-semibold text-red-900 mb-2">Critical Attention Required</h3>
                          <p className="text-sm text-red-700">
                            {patternsData.redFlags.filter(f => f.severity === 'critical').length} critical and{' '}
                            {patternsData.redFlags.filter(f => f.severity === 'high').length} high severity issues detected.
                          </p>
                        </div>

                        <div className="space-y-4">
                          {patternsData.redFlags.map((flag, i) => (
                            <div key={i} className={`rounded-lg p-4 border ${getSeverityColor(flag.severity)}`}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${getSeverityColor(flag.severity)}`}>
                                    {flag.severity}
                                  </span>
                                  <span className="font-semibold text-slate-900">{flag.metric}</span>
                                </div>
                                <div className="text-sm">
                                  <span className="font-bold text-red-600">{flag.value}</span>
                                  <span className="text-slate-500"> / threshold: {flag.threshold}</span>
                                </div>
                              </div>
                              <p className="text-slate-700">{flag.message}</p>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {!patternsData && !loading && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📊</span>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">No Data Yet</h2>
            <p className="text-slate-600">Start tracking to see behavioral patterns.</p>
          </div>
        )}
      </main>
    </div>
  );
}
