'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Site {
  id: string;
  name: string;
  domain: string;
}

interface FrictionStats {
  totalSessions: number;
  totalRageClicks: number;
  totalDeadClicks: number;
  totalMouseThrashes: number;
  totalFormAbandonments: number;
  totalFieldSkips: number;
  totalExitIntents: number;
  sessionsWithFriction: number;
  frictionRate: number;
}

interface TopIssue {
  type: string;
  element?: string;
  count: number;
  details?: string;
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
  topIssues: TopIssue[];
}

interface ProblemField {
  fieldName: string;
  fieldLabel: string | null;
  skips: number;
  abandonedAt: number;
}

interface FormFriction {
  formId: string | null;
  formName: string | null;
  path: string;
  abandonments: number;
  completions: number;
  abandonmentRate: number;
  problemFields: ProblemField[];
}

interface KeyFinding {
  finding: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  evidence: string;
  psychologicalCause?: string;
  userMindset?: string;
  impact: string;
  uxPrinciple?: string;
}

interface TopProblem {
  problem: string;
  location: string;
  frequency: string;
  rootCause?: string;
  userThinking?: string;
  whyItHappens?: string;
  recommendation: string;
}

interface FormIssue {
  form: string;
  issue: string;
  problemField: string;
  psychologicalBarrier?: string;
  recommendation: string;
}

interface UXPattern {
  pattern: string;
  principle?: string;
  evidence: string;
  userExperience?: string;
  userMindset?: string;
  solution: string;
}

interface PrioritizedAction {
  priority: number;
  action: string;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  psychologicalRationale?: string;
  rationale?: string;
  expectedOutcome?: string;
}

interface PeakEndAnalysis {
  currentPeakMoments: string;
  endingExperience: string;
  recommendations: string;
}

interface UserExperience {
  emotionalState: string;
  mentalModelViolations: string[];
  cognitiveLoadAssessment: string;
}

interface AIReport {
  summary: string;
  frictionLevel: 'low' | 'medium' | 'high' | 'critical';
  userExperience?: UserExperience;
  keyFindings: KeyFinding[];
  topProblems: TopProblem[];
  formIssues: FormIssue[];
  uxPatterns?: UXPattern[];
  prioritizedActions: PrioritizedAction[];
  peakEndAnalysis?: PeakEndAnalysis;
  trendsAndPatterns?: string[];
  source?: string;
  error?: string;
}

interface FrictionData {
  period: string;
  overallStats: FrictionStats;
  frictionByPage: FrictionByPage[];
  formFriction: FormFriction[];
  aiReport: AIReport | null;
}

export default function FrictionPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  const [frictionData, setFrictionData] = useState<FrictionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [period, setPeriod] = useState('7d');
  const [activeTab, setActiveTab] = useState<'overview' | 'pages' | 'forms' | 'report'>('overview');

  useEffect(() => {
    fetchSites();
  }, []);

  useEffect(() => {
    if (selectedSite) {
      fetchFrictionData(false);
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

  const fetchFrictionData = async (generateReport: boolean) => {
    if (!selectedSite) return;
    if (generateReport) setGenerating(true);
    else setLoading(true);

    try {
      const res = await fetch(`/api/friction?siteId=${selectedSite}&period=${period}&generateReport=${generateReport}`);
      const data = await res.json();
      setFrictionData(data);
      if (generateReport && data.aiReport) {
        setActiveTab('report');
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
    setGenerating(false);
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

  const getFrictionLevelColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'low': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  const getCognitiveLoadColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'overwhelming': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'moderate': return 'text-amber-600 bg-amber-100';
      case 'low': return 'text-emerald-600 bg-emerald-100';
      default: return 'text-slate-600 bg-slate-100';
    }
  };

  const getEffortImpactBadge = (value: string, type: 'effort' | 'impact') => {
    const colors = {
      effort: {
        low: 'bg-emerald-100 text-emerald-700',
        medium: 'bg-amber-100 text-amber-700',
        high: 'bg-red-100 text-red-700'
      },
      impact: {
        low: 'bg-slate-100 text-slate-700',
        medium: 'bg-blue-100 text-blue-700',
        high: 'bg-emerald-100 text-emerald-700'
      }
    };
    return colors[type][value as keyof typeof colors.effort] || 'bg-slate-100 text-slate-700';
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
              <Link href="/friction" className="text-indigo-600 font-medium text-sm">Friction Report</Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Friction Report</h1>
            <p className="text-slate-600 mt-1">Understand why users struggle with psychological insights</p>
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

        {frictionData && (
          <>
            {/* Overview Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-sm text-slate-500">Sessions</p>
                <p className="text-2xl font-bold text-slate-900">{frictionData.overallStats.totalSessions}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-sm text-slate-500">Friction Rate</p>
                <p className="text-2xl font-bold text-red-600">{frictionData.overallStats.frictionRate}%</p>
              </div>
              <div className="bg-white rounded-xl border border-red-200 p-4 bg-red-50">
                <p className="text-sm text-red-600">Rage Clicks</p>
                <p className="text-2xl font-bold text-red-700">{frictionData.overallStats.totalRageClicks}</p>
              </div>
              <div className="bg-white rounded-xl border border-orange-200 p-4 bg-orange-50">
                <p className="text-sm text-orange-600">Dead Clicks</p>
                <p className="text-2xl font-bold text-orange-700">{frictionData.overallStats.totalDeadClicks}</p>
              </div>
              <div className="bg-white rounded-xl border border-amber-200 p-4 bg-amber-50">
                <p className="text-sm text-amber-600">Mouse Thrash</p>
                <p className="text-2xl font-bold text-amber-700">{frictionData.overallStats.totalMouseThrashes}</p>
              </div>
              <div className="bg-white rounded-xl border border-purple-200 p-4 bg-purple-50">
                <p className="text-sm text-purple-600">Form Abandons</p>
                <p className="text-2xl font-bold text-purple-700">{frictionData.overallStats.totalFormAbandonments}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-sm text-slate-500">Exit Intents</p>
                <p className="text-2xl font-bold text-slate-900">{frictionData.overallStats.totalExitIntents}</p>
              </div>
            </div>

            {/* Generate Report Button */}
            {!frictionData.aiReport && (
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 mb-8 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">Generate AI Psychological Analysis</h2>
                    <p className="text-indigo-100 mt-1">Understand WHY users struggle using UX research frameworks</p>
                  </div>
                  <button
                    onClick={() => fetchFrictionData(true)}
                    disabled={generating}
                    className="bg-white text-indigo-600 px-6 py-3 rounded-lg font-medium hover:bg-indigo-50 disabled:opacity-50"
                  >
                    {generating ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Analyzing Psychology...
                      </span>
                    ) : (
                      '🧠 Analyze User Psychology'
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
                    { id: 'overview', label: '📊 Overview' },
                    { id: 'pages', label: '📄 Pages' },
                    { id: 'forms', label: '📝 Forms' },
                    { id: 'report', label: '🧠 Psychology Report', disabled: !frictionData.aiReport }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => !tab.disabled && setActiveTab(tab.id as typeof activeTab)}
                      disabled={tab.disabled}
                      className={`px-6 py-3 text-sm font-medium border-b-2 ${
                        activeTab === tab.id
                          ? 'border-indigo-600 text-indigo-600'
                          : tab.disabled
                          ? 'border-transparent text-slate-300 cursor-not-allowed'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-6">
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-4">Top Friction Pages</h3>
                      {frictionData.frictionByPage.length === 0 ? (
                        <p className="text-slate-500">No friction detected yet. Keep tracking!</p>
                      ) : (
                        <div className="space-y-3">
                          {frictionData.frictionByPage.slice(0, 5).map((page, i) => (
                            <div key={i} className="bg-slate-50 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-slate-900">{page.path}</span>
                                <span className={`px-2 py-1 rounded text-sm font-medium ${
                                  page.frictionScore > 5 ? 'bg-red-100 text-red-700' :
                                  page.frictionScore > 2 ? 'bg-amber-100 text-amber-700' :
                                  'bg-emerald-100 text-emerald-700'
                                }`}>
                                  Score: {page.frictionScore}
                                </span>
                              </div>
                              <div className="flex gap-4 text-sm text-slate-600">
                                {page.rageClicks > 0 && <span>🔴 {page.rageClicks} rage clicks</span>}
                                {page.deadClicks > 0 && <span>🟠 {page.deadClicks} dead clicks</span>}
                                {page.mouseThrashes > 0 && <span>🟡 {page.mouseThrashes} thrashing</span>}
                                {page.formAbandonments > 0 && <span>🟣 {page.formAbandonments} form abandons</span>}
                              </div>
                              {page.topIssues.length > 0 && (
                                <div className="mt-2 text-sm text-slate-500">
                                  Top issue: {page.topIssues[0].type} on &quot;{page.topIssues[0].element}&quot; ({page.topIssues[0].count}x)
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'pages' && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-slate-900">All Pages with Friction</h3>
                    {frictionData.frictionByPage.length === 0 ? (
                      <p className="text-slate-500">No friction detected on any pages.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-200">
                              <th className="text-left py-3 px-4 font-medium text-slate-600">Page</th>
                              <th className="text-center py-3 px-2 font-medium text-slate-600">Score</th>
                              <th className="text-center py-3 px-2 font-medium text-slate-600">Rage</th>
                              <th className="text-center py-3 px-2 font-medium text-slate-600">Dead</th>
                              <th className="text-center py-3 px-2 font-medium text-slate-600">Thrash</th>
                              <th className="text-center py-3 px-2 font-medium text-slate-600">Form</th>
                              <th className="text-center py-3 px-2 font-medium text-slate-600">Sessions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {frictionData.frictionByPage.map((page, i) => (
                              <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="py-3 px-4 font-medium text-slate-900 max-w-xs truncate">{page.path}</td>
                                <td className="py-3 px-2 text-center">
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    page.frictionScore > 5 ? 'bg-red-100 text-red-700' :
                                    page.frictionScore > 2 ? 'bg-amber-100 text-amber-700' :
                                    'bg-emerald-100 text-emerald-700'
                                  }`}>
                                    {page.frictionScore}
                                  </span>
                                </td>
                                <td className="py-3 px-2 text-center text-red-600">{page.rageClicks || '-'}</td>
                                <td className="py-3 px-2 text-center text-orange-600">{page.deadClicks || '-'}</td>
                                <td className="py-3 px-2 text-center text-amber-600">{page.mouseThrashes || '-'}</td>
                                <td className="py-3 px-2 text-center text-purple-600">{page.formAbandonments || '-'}</td>
                                <td className="py-3 px-2 text-center text-slate-600">{page.sessions}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'forms' && (
                  <div className="space-y-6">
                    <h3 className="font-semibold text-slate-900">Form Friction Analysis</h3>
                    {frictionData.formFriction.length === 0 ? (
                      <p className="text-slate-500">No form friction detected.</p>
                    ) : (
                      <div className="space-y-4">
                        {frictionData.formFriction.map((form, i) => (
                          <div key={i} className="bg-slate-50 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <span className="font-medium text-slate-900">
                                  {form.formName || form.formId || 'Form'} on {form.path}
                                </span>
                              </div>
                              <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                                {form.abandonments} abandonments
                              </span>
                            </div>
                            {form.problemFields.length > 0 && (
                              <div>
                                <p className="text-sm text-slate-600 mb-2">Problem fields:</p>
                                <div className="flex flex-wrap gap-2">
                                  {form.problemFields.map((field, j) => (
                                    <span key={j} className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-sm">
                                      <span className="font-medium">{field.fieldLabel || field.fieldName}</span>
                                      {field.skips > 0 && <span className="text-amber-600 ml-2">{field.skips} skips</span>}
                                      {field.abandonedAt > 0 && <span className="text-red-600 ml-2">{field.abandonedAt} abandoned here</span>}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'report' && frictionData.aiReport && (
                  <div className="space-y-8">
                    {/* Summary & User Experience */}
                    <div className={`rounded-xl p-6 border ${getFrictionLevelColor(frictionData.aiReport.frictionLevel)}`}>
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-3xl">
                          {frictionData.aiReport.frictionLevel === 'critical' ? '🚨' :
                           frictionData.aiReport.frictionLevel === 'high' ? '⚠️' :
                           frictionData.aiReport.frictionLevel === 'medium' ? '📊' : '✅'}
                        </span>
                        <div>
                          <span className="text-lg font-semibold capitalize">{frictionData.aiReport.frictionLevel} Friction Level</span>
                        </div>
                      </div>
                      <p className="text-slate-700 mb-4">{frictionData.aiReport.summary}</p>
                      
                      {frictionData.aiReport.userExperience && (
                        <div className="mt-4 pt-4 border-t border-current/20">
                          <h4 className="font-medium text-slate-800 mb-3">User Psychology Assessment</h4>
                          <div className="grid md:grid-cols-3 gap-4">
                            <div className="bg-white/50 rounded-lg p-3">
                              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Emotional State</p>
                              <p className="text-sm font-medium text-slate-800">{frictionData.aiReport.userExperience.emotionalState}</p>
                            </div>
                            <div className="bg-white/50 rounded-lg p-3">
                              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Cognitive Load</p>
                              <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getCognitiveLoadColor(frictionData.aiReport.userExperience.cognitiveLoadAssessment)}`}>
                                {frictionData.aiReport.userExperience.cognitiveLoadAssessment}
                              </span>
                            </div>
                            <div className="bg-white/50 rounded-lg p-3">
                              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Mental Model Violations</p>
                              <p className="text-sm text-slate-700">{frictionData.aiReport.userExperience.mentalModelViolations?.length || 0} found</p>
                            </div>
                          </div>
                          {frictionData.aiReport.userExperience.mentalModelViolations?.length > 0 && (
                            <div className="mt-3">
                              <p className="text-xs text-slate-500 mb-2">Expectation Violations:</p>
                              <ul className="text-sm text-slate-700 space-y-1">
                                {frictionData.aiReport.userExperience.mentalModelViolations.map((v, i) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <span className="text-red-500 mt-0.5">•</span>
                                    <span>{v}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* UX Patterns */}
                    {frictionData.aiReport.uxPatterns && frictionData.aiReport.uxPatterns.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-slate-900 mb-4">🎯 UX Patterns Detected</h3>
                        <div className="grid md:grid-cols-2 gap-4">
                          {frictionData.aiReport.uxPatterns.map((pattern, i) => (
                            <div key={i} className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4">
                              <div className="flex items-start justify-between mb-2">
                                <span className="font-semibold text-indigo-900">{pattern.pattern}</span>
                                {pattern.principle && (
                                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">
                                    {pattern.principle}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-slate-600 mb-2"><strong>Evidence:</strong> {pattern.evidence}</p>
                              {(pattern.userExperience || pattern.userMindset) && (
                                <p className="text-sm text-slate-600 mb-2">
                                  <strong>User feels:</strong> {pattern.userExperience || pattern.userMindset}
                                </p>
                              )}
                              <p className="text-sm text-emerald-700"><strong>Solution:</strong> {pattern.solution}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Key Findings */}
                    {frictionData.aiReport.keyFindings && frictionData.aiReport.keyFindings.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-slate-900 mb-4">🔍 Key Findings</h3>
                        <div className="space-y-3">
                          {frictionData.aiReport.keyFindings.map((finding, i) => (
                            <div key={i} className={`rounded-lg p-4 border ${getSeverityColor(finding.severity)}`}>
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${getSeverityColor(finding.severity)}`}>
                                  {finding.severity}
                                </span>
                                {(finding.psychologicalCause || finding.uxPrinciple) && (
                                  <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                                    {finding.psychologicalCause || finding.uxPrinciple}
                                  </span>
                                )}
                              </div>
                              <p className="font-medium text-slate-900">{finding.finding}</p>
                              <p className="text-sm text-slate-600 mt-1"><strong>Evidence:</strong> {finding.evidence}</p>
                              {finding.userMindset && (
                                <p className="text-sm text-slate-600"><strong>User thinking:</strong> &quot;{finding.userMindset}&quot;</p>
                              )}
                              <p className="text-sm text-slate-600"><strong>Impact:</strong> {finding.impact}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Peak-End Analysis */}
                    {frictionData.aiReport.peakEndAnalysis && (
                      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6">
                        <h3 className="font-semibold text-amber-900 mb-4">📈 Peak-End Rule Analysis</h3>
                        <p className="text-xs text-amber-700 mb-4">Users judge experiences by their peak (best/worst) moment and ending</p>
                        <div className="grid md:grid-cols-3 gap-4">
                          <div className="bg-white/70 rounded-lg p-3">
                            <p className="text-xs text-amber-600 uppercase tracking-wide mb-1">Peak Friction Moments</p>
                            <p className="text-sm text-slate-800">{frictionData.aiReport.peakEndAnalysis.currentPeakMoments}</p>
                          </div>
                          <div className="bg-white/70 rounded-lg p-3">
                            <p className="text-xs text-amber-600 uppercase tracking-wide mb-1">Session Endings</p>
                            <p className="text-sm text-slate-800">{frictionData.aiReport.peakEndAnalysis.endingExperience}</p>
                          </div>
                          <div className="bg-white/70 rounded-lg p-3">
                            <p className="text-xs text-amber-600 uppercase tracking-wide mb-1">Recommendations</p>
                            <p className="text-sm text-slate-800">{frictionData.aiReport.peakEndAnalysis.recommendations}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Prioritized Actions */}
                    {frictionData.aiReport.prioritizedActions && frictionData.aiReport.prioritizedActions.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-slate-900 mb-4">✅ Prioritized Actions</h3>
                        <div className="space-y-3">
                          {frictionData.aiReport.prioritizedActions.map((action, i) => (
                            <div key={i} className="bg-slate-50 rounded-lg p-4">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                                  {action.priority}
                                </span>
                                <span className="font-medium text-slate-900 flex-1">{action.action}</span>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${getEffortImpactBadge(action.effort, 'effort')}`}>
                                  {action.effort} effort
                                </span>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${getEffortImpactBadge(action.impact, 'impact')}`}>
                                  {action.impact} impact
                                </span>
                              </div>
                              <p className="text-sm text-slate-600 ml-11">
                                {action.psychologicalRationale || action.rationale}
                              </p>
                              {action.expectedOutcome && (
                                <p className="text-sm text-emerald-600 ml-11 mt-1">
                                  <strong>Expected:</strong> {action.expectedOutcome}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Top Problems */}
                    {frictionData.aiReport.topProblems && frictionData.aiReport.topProblems.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-slate-900 mb-4">🎯 Top Problems</h3>
                        <div className="grid md:grid-cols-2 gap-4">
                          {frictionData.aiReport.topProblems.map((problem, i) => (
                            <div key={i} className="bg-white border border-slate-200 rounded-lg p-4">
                              <p className="font-medium text-slate-900 mb-2">{problem.problem}</p>
                              <p className="text-sm text-slate-500">📍 {problem.location}</p>
                              <p className="text-sm text-slate-500">📈 {problem.frequency}</p>
                              {(problem.rootCause || problem.whyItHappens) && (
                                <p className="text-sm text-indigo-600 mt-2">
                                  <strong>Why:</strong> {problem.rootCause || problem.whyItHappens}
                                </p>
                              )}
                              {problem.userThinking && (
                                <p className="text-sm text-slate-600 mt-1 italic">
                                  User thinks: &quot;{problem.userThinking}&quot;
                                </p>
                              )}
                              <p className="text-sm text-emerald-600 mt-2">💡 {problem.recommendation}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Form Issues */}
                    {frictionData.aiReport.formIssues && frictionData.aiReport.formIssues.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-slate-900 mb-4">📝 Form Issues</h3>
                        <div className="space-y-3">
                          {frictionData.aiReport.formIssues.map((issue, i) => (
                            <div key={i} className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                              <p className="font-medium text-purple-900">{issue.form}: {issue.issue}</p>
                              <p className="text-sm text-purple-700 mt-1">Problem field: <strong>{issue.problemField}</strong></p>
                              {issue.psychologicalBarrier && (
                                <p className="text-sm text-purple-600 mt-1">
                                  <strong>Psychological barrier:</strong> {issue.psychologicalBarrier}
                                </p>
                              )}
                              <p className="text-sm text-emerald-600 mt-2">💡 {issue.recommendation}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Trends */}
                    {frictionData.aiReport.trendsAndPatterns && frictionData.aiReport.trendsAndPatterns.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-slate-900 mb-4">📈 Behavioral Trends</h3>
                        <ul className="space-y-2">
                          {frictionData.aiReport.trendsAndPatterns.map((trend, i) => (
                            <li key={i} className="flex items-start gap-2 text-slate-700">
                              <span className="text-indigo-500 mt-1">•</span>
                              <span>{trend}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {!frictionData && !loading && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📊</span>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">No Data Yet</h2>
            <p className="text-slate-600">Start tracking to see friction insights.</p>
          </div>
        )}
      </main>
    </div>
  );
}
