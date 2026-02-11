'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import SessionChat from '@/components/SessionChat';

interface FlowEvent {
  id: string;
  type: string;
  path: string;
  timestamp: string;
  detail?: string | null;
  data?: Record<string, unknown>;
  screenshotId?: string | null;
}

interface Flow {
  sessionId: string;
  visitorId: string;
  startedAt: string;
  endedAt: string | null;
  duration: number | null;
  entryPage: string | null;
  exitPage: string | null;
  deviceType: string | null;
  referrer: string | null;
  isBounce: boolean;
  country: string | null;
  region: string | null;
  city: string | null;
  totalEvents: number;
  pageViews: number;
  clicks: number;
  uniquePages: number;
  flowPath: FlowEvent[];
}

interface Site {
  id: string;
  name: string;
  domain: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface EmotionalMoment {
  moment: string;
  emotion: string;
  evidence: string;
}

interface FrictionPoint {
  issue: string;
  evidence: string;
  impact: string;
}

interface FlowAnalysis {
  userMindset: {
    state: string;
    confidence: 'high' | 'medium' | 'low';
    description: string;
  };
  primaryIntent: {
    goal: string;
    confidence: 'high' | 'medium' | 'low';
    reasoning: string;
  };
  intentSatisfaction: {
    satisfied: 'yes' | 'no' | 'partial' | 'unclear';
    confidence: 'high' | 'medium' | 'low';
    evidence: string[];
  };
  journeySummary: string;
  behavioralInsights: string[];
  emotionalJourney: EmotionalMoment[];
  frictionPoints: FrictionPoint[];
  recommendations: string[];
  source?: string;
}

interface FlowSummary {
  totalEvents: number;
  pageViews: number;
  clicks: number;
  uniquePages: number;
  pagesVisited: string[];
  timePerPage: Record<string, number>;
  mostEngagedPage: { path: string; duration: number } | null;
  backtracks: { from: string; to: string; timestamp: string }[];
  clicksByPage: Record<string, number>;
}

interface FlowDetail {
  session: Flow;
  timeline: FlowEvent[];
  summary: FlowSummary;
  analysis: FlowAnalysis | null;
}

export default function FlowsPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);
  const [flowDetail, setFlowDetail] = useState<FlowDetail | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [period, setPeriod] = useState('7d');
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'analysis' | 'timeline' | 'chat'>('analysis');
  const [screenshotModal, setScreenshotModal] = useState<{ open: boolean; imageData: string | null; loading: boolean }>({
    open: false,
    imageData: null,
    loading: false
  });
  const [screenshotStatus, setScreenshotStatus] = useState<Record<string, 'loading' | 'captured' | 'error'>>({});

  useEffect(() => {
    fetchSites();
  }, []);

  useEffect(() => {
    if (selectedSite) {
      fetchFlows();
    }
  }, [selectedSite, period, page]);

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

  const fetchFlows = async () => {
    if (!selectedSite) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/flows?siteId=${selectedSite}&period=${period}&page=${page}&limit=20`);
      const data = await res.json();
      setFlows(data.flows || []);
      setPagination(data.pagination);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const fetchFlowDetail = async (sessionId: string, analyze: boolean = false) => {
    if (!selectedSite) return;
    if (analyze) setAnalyzing(true);
    try {
      const res = await fetch(`/api/flows?siteId=${selectedSite}&sessionId=${sessionId}&analyze=${analyze}`);
      const data = await res.json();
      setFlowDetail(data);
    } catch (e) {
      console.error(e);
    }
    setAnalyzing(false);
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatTimeShort = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'pageview': return '📄';
      case 'click': return '👆';
      case 'scroll': return '📜';
      case 'scroll_milestone': return '🎯';
      case 'form_interact': return '✏️';
      case 'form_submit': return '📤';
      case 'navigation': return '🔀';
      case 'visibility': return '👁️';
      case 'pageexit': return '🚪';
      case 'exit_intent': return '⚠️';
      default: return '•';
    }
  };

  const getEventLabel = (type: string) => {
    switch (type) {
      case 'pageview': return 'Page View';
      case 'click': return 'Click';
      case 'scroll': return 'Scroll';
      case 'scroll_milestone': return 'Scroll Milestone';
      case 'form_interact': return 'Form Focus';
      case 'form_submit': return 'Form Submit';
      case 'navigation': return 'Navigation';
      case 'visibility': return 'Tab Switch';
      case 'pageexit': return 'Page Exit';
      case 'exit_intent': return 'Exit Intent';
      default: return type;
    }
  };

  const getDeviceIcon = (device: string | null) => {
    switch (device) {
      case 'mobile': return '📱';
      case 'tablet': return '📱';
      case 'desktop': return '💻';
      default: return '🖥️';
    }
  };

  const getMindsetEmoji = (state: string) => {
    const mindsets: Record<string, string> = {
      'exploring': '🔍',
      'researching': '📚',
      'comparing': '⚖️',
      'ready-to-buy': '💳',
      'confused': '😕',
      'frustrated': '😤',
      'curious': '🤔',
      'skeptical': '🧐',
      'urgent': '⚡',
      'casual-browsing': '😌'
    };
    return mindsets[state] || '🧠';
  };

  const getSatisfactionColor = (satisfied: string) => {
    switch (satisfied) {
      case 'yes': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'no': return 'bg-red-100 text-red-800 border-red-200';
      case 'partial': return 'bg-amber-100 text-amber-800 border-amber-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getSatisfactionLabel = (satisfied: string) => {
    switch (satisfied) {
      case 'yes': return '✅ Intent Satisfied';
      case 'no': return '❌ Intent Not Satisfied';
      case 'partial': return '⚠️ Partially Satisfied';
      default: return '❓ Unclear';
    }
  };

  const getConfidenceBadge = (confidence: string) => {
    const colors: Record<string, string> = {
      high: 'bg-emerald-100 text-emerald-700',
      medium: 'bg-amber-100 text-amber-700',
      low: 'bg-slate-100 text-slate-500'
    };
    return colors[confidence] || colors.low;
  };

  const getEventDetail = (event: FlowEvent) => {
    if (!event.data) return null;
    const data = event.data as Record<string, unknown>;
    if (data.elementText) return `Clicked: "${String(data.elementText).slice(0, 50)}"`;
    if (data.depth) return `Scroll depth: ${data.depth}%`;
    if (data.title) return `Title: ${data.title}`;
    if (data.timeOnPage) return `Time on page: ${Math.round(Number(data.timeOnPage) / 1000)}s`;
    return null;
  };

  const fetchScreenshot = async (screenshotId: string) => {
    if (!selectedSite) return;
    setScreenshotModal({ open: true, imageData: null, loading: true });
    try {
      const res = await fetch(`/api/screenshots?siteId=${selectedSite}&id=${screenshotId}`);
      const data = await res.json();
      if (data.screenshot) {
        setScreenshotModal({ open: true, imageData: data.screenshot.imageData, loading: false });
      } else {
        setScreenshotModal({ open: false, imageData: null, loading: false });
      }
    } catch (e) {
      console.error('Error fetching screenshot:', e);
      setScreenshotModal({ open: false, imageData: null, loading: false });
    }
  };

  const requestScreenshot = async (event: FlowEvent) => {
    if (!selectedSite || !flowDetail) return;

    setScreenshotStatus(prev => ({ ...prev, [event.id]: 'loading' }));

    // For now, we'll show an info message since screenshots need to be captured
    // from the actual user's browser session. In a real implementation, this would
    // either use a replay system or require the session to still be active.

    // Since this is historical data, we can't capture screenshots retroactively.
    // The screenshot feature works for live sessions where the tracker can capture.

    // For demo purposes, let's show the limitation
    setTimeout(() => {
      setScreenshotStatus(prev => ({ ...prev, [event.id]: 'error' }));
    }, 1000);
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
                  onChange={(e) => { setSelectedSite(e.target.value); setPage(1); }}
                  className="ml-4 border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white"
                >
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>{site.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-slate-600 hover:text-slate-900 font-medium text-sm">Dashboard</Link>
              <Link href="/flows" className="text-indigo-600 font-medium text-sm">User Flows</Link>
              <Link href="/friction" className="text-slate-600 hover:text-slate-900 font-medium text-sm">Patterns</Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900">User Flows</h1>
          <div className="flex gap-2">
            {['7d', '30d', '90d'].map((p) => (
              <button
                key={p}
                onClick={() => { setPeriod(p); setPage(1); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  period === p
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-slate-600 border border-slate-300'
                }`}
              >
                {p === '7d' ? 'Last 7 days' : p === '30d' ? 'Last 30 days' : 'Last 90 days'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Flows List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-200">
                <h2 className="font-semibold text-slate-900">Sessions ({pagination?.total || 0})</h2>
              </div>
              <div className="divide-y divide-slate-100 max-h-[calc(100vh-280px)] overflow-y-auto">
                {loading ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                  </div>
                ) : flows.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    No sessions found
                  </div>
                ) : (
                  flows.map((flow) => (
                    <button
                      key={flow.sessionId}
                      onClick={() => { setSelectedFlow(flow); fetchFlowDetail(flow.sessionId, false); }}
                      className={`w-full p-4 text-left hover:bg-slate-50 transition-colors ${
                        selectedFlow?.sessionId === flow.sessionId ? 'bg-indigo-50' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs text-slate-500">{formatTime(flow.startedAt)}</span>
                        <span className="text-lg">{getDeviceIcon(flow.deviceType)}</span>
                      </div>
                      <div className="text-sm font-medium text-slate-900 truncate mb-1">
                        {flow.entryPage || '/'}
                      </div>
                      {(flow.city || flow.region || flow.country) && (
                        <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                          <span>📍</span>
                          <span className="truncate">
                            {[flow.city, flow.region, flow.country].filter(Boolean).join(', ')}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span>{flow.pageViews} pages</span>
                        <span>{flow.clicks} clicks</span>
                        <span>{formatDuration(flow.duration)}</span>
                      </div>
                      {flow.isBounce && (
                        <span className="inline-block mt-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                          Bounce
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
              {pagination && pagination.totalPages > 1 && (
                <div className="p-4 border-t border-slate-200 flex justify-between items-center">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 text-sm border border-slate-300 rounded disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-slate-600">
                    Page {page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                    disabled={page === pagination.totalPages}
                    className="px-3 py-1 text-sm border border-slate-300 rounded disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Flow Detail */}
          <div className="lg:col-span-2">
            {selectedFlow && flowDetail ? (
              <div className="bg-white rounded-xl border border-slate-200">
                <div className="p-6 border-b border-slate-200">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Session Analysis</h2>
                      <p className="text-sm text-slate-500">
                        {formatTime(selectedFlow.startedAt)} • {formatDuration(selectedFlow.duration)}
                      </p>
                      {(selectedFlow.city || selectedFlow.region || selectedFlow.country) && (
                        <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                          <span>📍</span>
                          {[selectedFlow.city, selectedFlow.region, selectedFlow.country].filter(Boolean).join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{getDeviceIcon(selectedFlow.deviceType)}</span>
                      {!flowDetail.analysis && (
                        <button
                          onClick={() => fetchFlowDetail(selectedFlow.sessionId, true)}
                          disabled={analyzing}
                          className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {analyzing ? 'Analyzing...' : '🧠 Analyze Behavior'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-slate-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-slate-900">{flowDetail.summary.pageViews}</p>
                      <p className="text-xs text-slate-500">Pages</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-slate-900">{flowDetail.summary.clicks}</p>
                      <p className="text-xs text-slate-500">Clicks</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-slate-900">{flowDetail.summary.totalEvents}</p>
                      <p className="text-xs text-slate-500">Events</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-slate-900">{flowDetail.summary.backtracks.length}</p>
                      <p className="text-xs text-slate-500">Backtracks</p>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="border-b border-slate-200">
                  <div className="flex">
                    <button
                      onClick={() => setActiveTab('analysis')}
                      className={`px-6 py-3 text-sm font-medium border-b-2 ${
                        activeTab === 'analysis'
                          ? 'border-indigo-600 text-indigo-600'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      🧠 Psychological Analysis
                    </button>
                    <button
                      onClick={() => setActiveTab('timeline')}
                      className={`px-6 py-3 text-sm font-medium border-b-2 ${
                        activeTab === 'timeline'
                          ? 'border-indigo-600 text-indigo-600'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      📋 Event Timeline
                    </button>
                    <button
                      onClick={() => setActiveTab('chat')}
                      className={`px-6 py-3 text-sm font-medium border-b-2 ${
                        activeTab === 'chat'
                          ? 'border-indigo-600 text-indigo-600'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      💬 Ask AI
                    </button>
                  </div>
                </div>

                <div className="p-6 max-h-[calc(100vh-400px)] overflow-y-auto">
                  {activeTab === 'analysis' ? (
                    flowDetail.analysis && flowDetail.analysis.source === 'ai' ? (
                      <div className="space-y-6">
                        {/* User Mindset */}
                        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-5 border border-purple-100">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-3xl">{getMindsetEmoji(flowDetail.analysis.userMindset.state)}</span>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-slate-900">User Mindset: {flowDetail.analysis.userMindset.state.replace('-', ' ')}</h3>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getConfidenceBadge(flowDetail.analysis.userMindset.confidence)}`}>
                                  {flowDetail.analysis.userMindset.confidence} confidence
                                </span>
                              </div>
                            </div>
                          </div>
                          <p className="text-slate-700">{flowDetail.analysis.userMindset.description}</p>
                        </div>

                        {/* Primary Intent */}
                        <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-slate-900">🎯 Primary Intent</h3>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getConfidenceBadge(flowDetail.analysis.primaryIntent.confidence)}`}>
                              {flowDetail.analysis.primaryIntent.confidence} confidence
                            </span>
                          </div>
                          <p className="text-lg font-medium text-blue-800 mb-2">{flowDetail.analysis.primaryIntent.goal}</p>
                          <p className="text-sm text-slate-600">{flowDetail.analysis.primaryIntent.reasoning}</p>
                        </div>

                        {/* Intent Satisfaction */}
                        <div className={`rounded-xl p-5 border ${getSatisfactionColor(flowDetail.analysis.intentSatisfaction.satisfied)}`}>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold">{getSatisfactionLabel(flowDetail.analysis.intentSatisfaction.satisfied)}</h3>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getConfidenceBadge(flowDetail.analysis.intentSatisfaction.confidence)}`}>
                              {flowDetail.analysis.intentSatisfaction.confidence} confidence
                            </span>
                          </div>
                          <ul className="space-y-1">
                            {flowDetail.analysis.intentSatisfaction.evidence.map((e, i) => (
                              <li key={i} className="text-sm flex items-start gap-2">
                                <span className="mt-1">•</span>
                                <span>{e}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Journey Summary */}
                        <div>
                          <h3 className="font-semibold text-slate-900 mb-2">📖 Journey Story</h3>
                          <p className="text-slate-700 leading-relaxed">{flowDetail.analysis.journeySummary}</p>
                        </div>

                        {/* Emotional Journey */}
                        {flowDetail.analysis.emotionalJourney && flowDetail.analysis.emotionalJourney.length > 0 && (
                          <div>
                            <h3 className="font-semibold text-slate-900 mb-3">💭 Emotional Journey</h3>
                            <div className="space-y-3">
                              {flowDetail.analysis.emotionalJourney.map((moment, i) => (
                                <div key={i} className="flex items-start gap-3 bg-slate-50 rounded-lg p-3">
                                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-medium text-indigo-600">
                                    {i + 1}
                                  </div>
                                  <div>
                                    <p className="font-medium text-slate-900">{moment.moment}</p>
                                    <p className="text-sm text-indigo-600">Feeling: {moment.emotion}</p>
                                    <p className="text-sm text-slate-500">{moment.evidence}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Behavioral Insights */}
                        <div>
                          <h3 className="font-semibold text-slate-900 mb-3">🔬 Behavioral Insights</h3>
                          <ul className="space-y-2">
                            {flowDetail.analysis.behavioralInsights.map((insight, i) => (
                              <li key={i} className="flex items-start gap-2 bg-slate-50 rounded-lg p-3">
                                <span className="text-indigo-500 mt-0.5">💡</span>
                                <span className="text-slate-700">{insight}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Friction Points */}
                        {flowDetail.analysis.frictionPoints && flowDetail.analysis.frictionPoints.length > 0 && (
                          <div>
                            <h3 className="font-semibold text-slate-900 mb-3">⚠️ Friction Points</h3>
                            <div className="space-y-3">
                              {flowDetail.analysis.frictionPoints.map((point, i) => (
                                <div key={i} className="bg-red-50 border border-red-100 rounded-lg p-4">
                                  <p className="font-medium text-red-800">{point.issue}</p>
                                  <p className="text-sm text-red-700 mt-1">Evidence: {point.evidence}</p>
                                  <p className="text-sm text-red-600 mt-1">Impact: {point.impact}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Recommendations */}
                        {flowDetail.analysis.recommendations && flowDetail.analysis.recommendations.length > 0 && (
                          <div>
                            <h3 className="font-semibold text-slate-900 mb-3">✅ Recommendations</h3>
                            <ul className="space-y-2">
                              {flowDetail.analysis.recommendations.map((rec, i) => (
                                <li key={i} className="flex items-start gap-2 bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                                  <span className="text-emerald-600 mt-0.5">→</span>
                                  <span className="text-emerald-800">{rec}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Time Per Page */}
                        {Object.keys(flowDetail.summary.timePerPage).length > 0 && (
                          <div>
                            <h3 className="font-semibold text-slate-900 mb-3">⏱️ Time Investment</h3>
                            <div className="space-y-2">
                              {Object.entries(flowDetail.summary.timePerPage)
                                .sort((a, b) => b[1] - a[1])
                                .map(([pagePath, time]) => {
                                  const maxTime = Math.max(...Object.values(flowDetail.summary.timePerPage));
                                  const percentage = (time / maxTime) * 100;
                                  return (
                                    <div key={pagePath}>
                                      <div className="flex justify-between text-sm mb-1">
                                        <span className="text-slate-600 truncate max-w-[250px]">{pagePath}</span>
                                        <span className="text-slate-900 font-medium">{formatDuration(time)}</span>
                                      </div>
                                      <div className="h-2 bg-slate-100 rounded-full">
                                        <div 
                                          className="h-full bg-indigo-500 rounded-full" 
                                          style={{ width: `${percentage}%` }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <span className="text-4xl">🧠</span>
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 mb-2">Behavioral Analysis</h3>
                        <p className="text-slate-500 mb-6 max-w-md mx-auto">
                          Understand what this user was thinking, what they wanted to achieve, and whether they succeeded.
                        </p>
                        <button
                          onClick={() => fetchFlowDetail(selectedFlow.sessionId, true)}
                          disabled={analyzing}
                          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 font-medium"
                        >
                          {analyzing ? (
                            <span className="flex items-center gap-2">
                              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              Analyzing user psychology...
                            </span>
                          ) : (
                            '🧠 Analyze User Psychology'
                          )}
                        </button>
                      </div>
                    )
                  ) : activeTab === 'timeline' ? (
                    <div className="relative">
                      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200"></div>
                      <div className="space-y-4">
                        {flowDetail.timeline.map((event, index) => (
                          <div key={index} className="relative pl-10">
                            <div className="absolute left-2 w-5 h-5 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center text-xs">
                              {getEventIcon(event.type)}
                            </div>
                            <div className="bg-slate-50 rounded-lg p-3">
                              <div className="flex justify-between items-start">
                                <span className="font-medium text-slate-900 text-sm">
                                  {getEventLabel(event.type)}
                                </span>
                                <div className="flex items-center gap-2">
                                  {/* Screenshot button/status */}
                                  {event.screenshotId ? (
                                    <button
                                      onClick={() => fetchScreenshot(event.screenshotId!)}
                                      className="flex items-center gap-1 px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors"
                                      title="View screenshot"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                      View
                                    </button>
                                  ) : event.type === 'pageview' ? (
                                    <span className="text-xs text-slate-400" title="Screenshots are captured in real-time during active sessions">
                                      No screenshot
                                    </span>
                                  ) : null}
                                  <span className="text-xs text-slate-500">
                                    {formatTimeShort(event.timestamp)}
                                  </span>
                                </div>
                              </div>
                              <p className="text-sm text-slate-600 mt-1">{event.path}</p>
                              {getEventDetail(event) && (
                                <p className="mt-2 text-xs text-slate-500">{getEventDetail(event)}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : activeTab === 'chat' ? (
                    <div className="h-[400px]">
                      <SessionChat sessionId={selectedFlow.sessionId} siteId={selectedSite!} />
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-4xl">👤</span>
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">Select a Session</h3>
                <p className="text-slate-500">Click on a session to understand user behavior and intent</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Screenshot Modal */}
      {screenshotModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center p-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Page Screenshot</h3>
              <button
                onClick={() => setScreenshotModal({ open: false, imageData: null, loading: false })}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[calc(90vh-60px)]">
              {screenshotModal.loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
              ) : screenshotModal.imageData ? (
                <img
                  src={screenshotModal.imageData}
                  alt="Page screenshot"
                  className="w-full h-auto rounded-lg border border-slate-200"
                />
              ) : (
                <div className="text-center py-12 text-slate-500">
                  Failed to load screenshot
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
