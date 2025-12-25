'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface FlowEvent {
  type: string;
  path: string;
  timestamp: string;
  detail?: string | null;
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

export default function FlowsPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);
  const [flowDetail, setFlowDetail] = useState<{ session: Flow; timeline: FlowEvent[]; summary: { totalEvents: number; pageViews: number; clicks: number; uniquePages: number; pagesVisited: string[] } } | null>(null);
  const [period, setPeriod] = useState('7d');
  const [page, setPage] = useState(1);

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

  const fetchFlowDetail = async (sessionId: string) => {
    if (!selectedSite) return;
    try {
      const res = await fetch(`/api/flows?siteId=${selectedSite}&sessionId=${sessionId}`);
      const data = await res.json();
      setFlowDetail(data);
    } catch (e) {
      console.error(e);
    }
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
                      onClick={() => { setSelectedFlow(flow); fetchFlowDetail(flow.sessionId); }}
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
                    <span className="text-2xl">{getDeviceIcon(selectedFlow.deviceType)}</span>
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

                  {selectedFlow.referrer && (
                    <div className="mt-4 text-sm">
                      <span className="text-slate-500">Referrer: </span>
                      <span className="text-slate-700">{selectedFlow.referrer}</span>
                    </div>
                  )}

                  {flowDetail.summary.pagesVisited.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs text-slate-500 mb-2">Pages Visited:</p>
                      <div className="flex flex-wrap gap-2">
                        {flowDetail.summary.pagesVisited.map((page, i) => (
                          <span key={i} className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded">
                            {page}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-6">
                  <h3 className="font-semibold text-slate-900 mb-4">Event Timeline</h3>
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
                            {event.data && typeof event.data === 'object' && (
                              <div className="mt-2 text-xs text-slate-500">
                                {(event.data as { elementText?: string }).elementText && (
                                  <span>Clicked: "{(event.data as { elementText?: string }).elementText}"</span>
                                )}
                                {(event.data as { depth?: number }).depth && (
                                  <span>Scroll depth: {(event.data as { depth?: number }).depth}%</span>
                                )}
                                {(event.data as { title?: string }).title && (
                                  <span>Title: {(event.data as { title?: string }).title}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
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
                <p className="text-slate-500">Click on a session from the list to view the complete user flow</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
