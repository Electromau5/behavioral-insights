'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface FlowEvent {
  type: string;
  path: string;
  timestamp: string;
  detail?: string | null;
  data?: Record<string, unknown>;
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

interface FlowAnalysis {
  intent: string;
  intentConfidence: 'high' | 'medium' | 'low';
  summary: string;
  engagement: 'high' | 'medium' | 'low';
  engagementReason: string;
  keyInsights: string[];
  mostEngagedSection: string;
  frictionPoints: string[];
  recommendations: string[];
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
  const [activeTab, setActiveTab] = useState<'timeline' | 'analysis'>('analysis');

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

  const getEngagementColor = (level: string) => {
    switch (level) {
      case 'high': return 'bg-emerald-100 text-emerald-800';
      case 'medium': return 'bg-amber-100 text-amber-800';
      case 'low': return 'bg-red-100 text-red-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getConfidenceColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-emerald-600';
      case 'medium': return 'text-amber-600';
      case 'low': return 'text-slate-400';
      default: return 'text-slate-400';
    }
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
              <Link href="/" className="flex items-center gap-2">
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
                      <h2 className="text-lg font-semibold text-slate-900">Session Details</h2>
                      <p className="text-sm text-slate-500">
                        Started {formatTime(selectedFlow.startedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{getDeviceIcon(selectedFlow.deviceType)}</span>
                      {!flowDetail.analysis && (
                        <button
                          onClick={() => fetchFlowDetail(selectedFlow.sessionId, true)}
                          disabled={analyzing}
                          className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {analyzing ? 'Analyzing...' : '✨ Analyze with AI'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Duration</p>
                      <p className="text-lg font-semibold text-slate-900">{formatDuration(selectedFlow.duration)}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Pages</p>
                      <p className="text-lg font-semibold text-slate-900">{flowDetail.summary.pageViews}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Clicks</p>
                      <p className="text-lg font-semibold text-slate-900">{flowDetail.summary.clicks}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Events</p>
                      <p className="text-lg font-semibold text-slate-900">{flowDetail.summary.totalEvents}</p>
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
                      AI Analysis
                    </button>
                    <button
                      onClick={() => setActiveTab('timeline')}
                      className={`px-6 py-3 text-sm font-medium border-b-2 ${
                        activeTab === 'timeline'
                          ? 'border-indigo-600 text-indigo-600'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Event Timeline
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  {activeTab === 'analysis' ? (
                    flowDetail.analysis ? (
                      <div className="space-y-6">
                        {/* Intent */}
                        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-5">
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="font-semibold text-slate-900">🎯 User Intent</h3>
                            <span className={`text-xs font-medium ${getConfidenceColor(flowDetail.analysis.intentConfidence)}`}>
                              {flowDetail.analysis.intentConfidence} confidence
                            </span>
                          </div>
                          <p className="text-slate-700">{flowDetail.analysis.intent}</p>
                        </div>

                        {/* Summary */}
                        <div>
                          <h3 className="font-semibold text-slate-900 mb-2">📝 Summary</h3>
                          <p className="text-slate-600">{flowDetail.analysis.summary}</p>
                        </div>

                        {/* Engagement & Most Engaged */}
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="bg-slate-50 rounded-lg p-4">
                            <h3 className="font-semibold text-slate-900 mb-2">📊 Engagement Level</h3>
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getEngagementColor(flowDetail.analysis.engagement)}`}>
                              {flowDetail.analysis.engagement.charAt(0).toUpperCase() + flowDetail.analysis.engagement.slice(1)}
                            </span>
                            <p className="text-sm text-slate-500 mt-2">{flowDetail.analysis.engagementReason}</p>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-4">
                            <h3 className="font-semibold text-slate-900 mb-2">🔥 Most Engaged Section</h3>
                            <p className="text-indigo-600 font-medium">{flowDetail.analysis.mostEngagedSection}</p>
                            {flowDetail.summary.mostEngagedPage && (
                              <p className="text-sm text-slate-500 mt-1">
                                Spent {formatDuration(flowDetail.summary.mostEngagedPage.duration)} here
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Key Insights */}
                        <div>
                          <h3 className="font-semibold text-slate-900 mb-3">💡 Key Insights</h3>
                          <ul className="space-y-2">
                            {flowDetail.analysis.keyInsights.map((insight, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-indigo-500 mt-1">•</span>
                                <span className="text-slate-600">{insight}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Backtracking */}
                        {flowDetail.summary.backtracks.length > 0 && (
                          <div className="bg-amber-50 rounded-lg p-4">
                            <h3 className="font-semibold text-amber-800 mb-2">🔄 Backtracking Detected</h3>
                            <p className="text-sm text-amber-700 mb-2">
                              User returned to previously visited pages {flowDetail.summary.backtracks.length} time(s):
                            </p>
                            <ul className="space-y-1">
                              {flowDetail.summary.backtracks.map((bt, i) => (
                                <li key={i} className="text-sm text-amber-600">
                                  {bt.from} → {bt.to}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Friction Points */}
                        {flowDetail.analysis.frictionPoints.length > 0 && (
                          <div className="bg-red-50 rounded-lg p-4">
                            <h3 className="font-semibold text-red-800 mb-2">⚠️ Potential Friction Points</h3>
                            <ul className="space-y-1">
                              {flowDetail.analysis.frictionPoints.map((point, i) => (
                                <li key={i} className="text-sm text-red-700">• {point}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Recommendations */}
                        {flowDetail.analysis.recommendations.length > 0 && (
                          <div className="bg-emerald-50 rounded-lg p-4">
                            <h3 className="font-semibold text-emerald-800 mb-2">✅ Recommendations</h3>
                            <ul className="space-y-1">
                              {flowDetail.analysis.recommendations.map((rec, i) => (
                                <li key={i} className="text-sm text-emerald-700">• {rec}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Time Per Page */}
                        {Object.keys(flowDetail.summary.timePerPage).length > 0 && (
                          <div>
                            <h3 className="font-semibold text-slate-900 mb-3">⏱️ Time Spent Per Page</h3>
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
                        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <span className="text-3xl">✨</span>
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 mb-2">AI Analysis Available</h3>
                        <p className="text-slate-500 mb-4">Get insights about user intent, engagement, and recommendations</p>
                        <button
                          onClick={() => fetchFlowDetail(selectedFlow.sessionId, true)}
                          disabled={analyzing}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {analyzing ? 'Analyzing...' : 'Generate AI Analysis'}
                        </button>
                      </div>
                    )
                  ) : (
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
                                <span className="text-xs text-slate-500">
                                  {formatTimeShort(event.timestamp)}
                                </span>
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
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">Select a Session</h3>
                <p className="text-slate-500">Click on a session from the list to view the complete user flow and AI analysis</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
