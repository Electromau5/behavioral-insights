'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';

interface Site {
  id: string;
  name: string;
  domain: string;
  ipExclusionEnabled?: boolean;
  excludedIps?: string[] | null;
}

interface Insight {
  id: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  changePercent?: number;
}

interface Metrics {
  overview: {
    totalSessions: number;
    uniqueVisitors: number;
    totalPageViews: number;
    avgSessionDuration: number;
    avgScrollDepth: number;
    bounceRate: number;
  };
  topPages: Array<{ path: string; views: number }>;
  deviceBreakdown: Array<{ device: string; count: number }>;
}

export default function Dashboard() {
  const { data: session } = useSession();
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddSite, setShowAddSite] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteDomain, setNewSiteDomain] = useState('');
  const [trackingCode, setTrackingCode] = useState('');
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [period, setPeriod] = useState('7d');
  const [showTrackingCode, setShowTrackingCode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingSite, setDeletingSite] = useState(false);
  const [showIpExclusions, setShowIpExclusions] = useState(false);
  const [ipExclusionEnabled, setIpExclusionEnabled] = useState(false);
  const [excludedIps, setExcludedIps] = useState<string[]>([]);
  const [newIp, setNewIp] = useState('');
  const [ipError, setIpError] = useState('');
  const [myIp, setMyIp] = useState<string | null>(null);
  const [savingIps, setSavingIps] = useState(false);

  useEffect(() => { fetchSites(); }, []);
  
  useEffect(() => {
    if (selectedSite) {
      fetchMetrics(selectedSite);
      fetchInsights(selectedSite);
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

  const fetchMetrics = async (siteId: string) => {
    try {
      const res = await fetch(`/api/metrics?siteId=${siteId}&period=${period}`);
      setMetrics(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchInsights = async (siteId: string) => {
    try {
      const res = await fetch(`/api/insights?siteId=${siteId}`);
      const data = await res.json();
      setInsights(data.insights || []);
    } catch (e) { console.error(e); }
  };

  const generateInsights = async () => {
    if (!selectedSite) return;
    setGeneratingInsights(true);
    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: selectedSite, period })
      });
      const data = await res.json();
      setInsights(data.insights || []);
    } catch (e) { console.error(e); }
    setGeneratingInsights(false);
  };

  const addSite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSiteName, domain: newSiteDomain })
      });
      const data = await res.json();
      setTrackingCode(data.trackingCode);
      setSites([data.site, ...sites]);
      setSelectedSite(data.site.id);
      setNewSiteName('');
      setNewSiteDomain('');
    } catch (e) { console.error(e); }
  };

  const deleteSite = async () => {
    if (!selectedSite) return;
    setDeletingSite(true);
    try {
      await fetch(`/api/sites?id=${selectedSite}`, { method: 'DELETE' });
      const remaining = sites.filter(s => s.id !== selectedSite);
      setSites(remaining);
      setSelectedSite(remaining.length > 0 ? remaining[0].id : null);
      setMetrics(null);
      setInsights([]);
    } catch (e) { console.error(e); }
    setDeletingSite(false);
    setShowDeleteConfirm(false);
  };

  const openIpExclusions = async () => {
    const site = sites.find(s => s.id === selectedSite);
    setIpExclusionEnabled(site?.ipExclusionEnabled || false);
    setExcludedIps(site?.excludedIps || []);
    setNewIp('');
    setIpError('');
    setShowIpExclusions(true);
    try {
      const res = await fetch('/api/my-ip');
      const data = await res.json();
      setMyIp(data.ip || null);
    } catch (e) { console.error(e); }
  };

  const addIp = (ip: string) => {
    const value = ip.trim();
    if (!value) return;
    // Exact IPv4/IPv6 or IPv4 CIDR like 203.0.113.0/24
    const isValid = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(value) || /^[0-9a-fA-F:]+$/.test(value) && value.includes(':');
    if (!isValid) {
      setIpError('Enter a valid IP address (e.g. 203.0.113.7) or CIDR range (e.g. 203.0.113.0/24)');
      return;
    }
    if (excludedIps.includes(value)) {
      setIpError('That IP is already in the list');
      return;
    }
    setExcludedIps([...excludedIps, value]);
    setNewIp('');
    setIpError('');
  };

  const saveIpExclusions = async () => {
    if (!selectedSite) return;
    setSavingIps(true);
    setIpError('');
    try {
      const res = await fetch('/api/sites', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: selectedSite, ipExclusionEnabled, excludedIps })
      });
      const data = await res.json();
      if (!res.ok) {
        setIpError(data.error || 'Failed to save');
      } else {
        setSites(sites.map(s => s.id === selectedSite ? { ...s, ipExclusionEnabled, excludedIps } : s));
        setShowIpExclusions(false);
      }
    } catch (e) {
      console.error(e);
      setIpError('Failed to save');
    }
    setSavingIps(false);
  };

  const currentSite = sites.find(s => s.id === selectedSite);
  const currentTrackingCode = selectedSite
    ? `<script src="https://behavioral-insights.vercel.app/tracker.js" data-site-id="${selectedSite}"></script>`
    : '';

  const formatDuration = (s: number) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  
  const getSeverityColor = (severity: string) => {
    if (severity === 'critical') return 'bg-red-100 text-red-800 border-red-200';
    if (severity === 'warning') return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  if (loading) {
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
                <div className="ml-4 flex items-center gap-2">
                  <select
                    value={selectedSite || ''}
                    onChange={(e) => setSelectedSite(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white text-slate-900"
                  >
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>{site.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setShowTrackingCode(true)}
                    title="View tracking code"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-300 hover:border-indigo-300"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                  </button>
                  <button
                    onClick={openIpExclusions}
                    title="IP exclusions"
                    className={`p-1.5 rounded-lg border ${
                      currentSite?.ipExclusionEnabled
                        ? 'text-indigo-600 bg-indigo-50 border-indigo-300'
                        : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border-slate-300 hover:border-indigo-300'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    title="Remove site"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-300 hover:border-red-300"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-indigo-600 font-medium text-sm">Dashboard</Link>
              <Link href="/flows" className="text-slate-600 hover:text-slate-900 font-medium text-sm">User Flows</Link>
              <Link href="/friction" className="text-slate-600 hover:text-slate-900 font-medium text-sm">Patterns</Link>
              <button onClick={() => setShowAddSite(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                Add Site
              </button>
              
              {/* User Menu */}
              <div className="relative">
                <button 
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900"
                >
                  <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                    <span className="text-indigo-600 font-medium">
                      {session?.user?.name?.[0] || session?.user?.email?.[0]?.toUpperCase() || 'U'}
                    </span>
                  </div>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-sm font-medium text-slate-900">{session?.user?.name || 'User'}</p>
                      <p className="text-xs text-slate-500 truncate">{session?.user?.email}</p>
                    </div>
                    <Link href="/settings" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Settings</Link>
                    <button 
                      onClick={() => signOut({ callbackUrl: '/login' })}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {sites.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Add Your First Site</h2>
            <p className="text-slate-600 mb-6">Start tracking user behavior by adding your website.</p>
            <button onClick={() => setShowAddSite(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium">Add Site</button>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-6">
              <div className="flex gap-2">
                {['7d', '30d', '90d'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${
                      period === p ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-300'
                    }`}
                  >
                    {p === '7d' ? 'Last 7 days' : p === '30d' ? 'Last 30 days' : 'Last 90 days'}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Link href="/friction" className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-100">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Behavioral Patterns
                </Link>
                <Link href="/flows" className="flex items-center gap-2 bg-white border border-slate-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  User Flows
                </Link>
                <button onClick={generateInsights} disabled={generatingInsights} className="flex items-center gap-2 bg-white border border-slate-300 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                  {generatingInsights ? 'Generating...' : 'Generate AI Insights'}
                </button>
              </div>
            </div>

            {insights.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">AI Insights</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {insights.map((insight) => (
                    <div key={insight.id} className={`p-4 rounded-xl border ${getSeverityColor(insight.severity)}`}>
                      <h3 className="font-semibold">{insight.title}</h3>
                      <p className="text-sm mt-1 opacity-90">{insight.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-sm text-slate-500">Sessions</p>
                <p className="text-2xl font-bold text-slate-900">{metrics?.overview?.totalSessions || 0}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-sm text-slate-500">Visitors</p>
                <p className="text-2xl font-bold text-slate-900">{metrics?.overview?.uniqueVisitors || 0}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-sm text-slate-500">Page Views</p>
                <p className="text-2xl font-bold text-slate-900">{metrics?.overview?.totalPageViews || 0}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-sm text-slate-500">Avg. Duration</p>
                <p className="text-2xl font-bold text-slate-900">{formatDuration(metrics?.overview?.avgSessionDuration || 0)}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-sm text-slate-500">Bounce Rate</p>
                <p className="text-2xl font-bold text-slate-900">{metrics?.overview?.bounceRate || 0}%</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-sm text-slate-500">Scroll Depth</p>
                <p className="text-2xl font-bold text-slate-900">{metrics?.overview?.avgScrollDepth || 0}%</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-4">Top Pages</h3>
                {metrics?.topPages?.length ? (
                  <div className="space-y-3">
                    {metrics.topPages.slice(0, 5).map((page, i) => (
                      <div key={i} className="flex justify-between">
                        <span className="text-sm text-slate-600 truncate max-w-[200px]">{page.path}</span>
                        <span className="text-slate-900 font-medium text-sm">{page.views} views</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No data yet.</p>
                )}
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-4">Devices</h3>
                {metrics?.deviceBreakdown?.length ? (
                  <div className="space-y-3">
                    {metrics.deviceBreakdown.map((device, i) => {
                      const total = metrics.deviceBreakdown.reduce((sum, d) => sum + Number(d.count), 0);
                      const percent = total > 0 ? Math.round((Number(device.count) / total) * 100) : 0;
                      return (
                        <div key={i}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-slate-600 capitalize">{device.device || 'Unknown'}</span>
                            <span className="text-slate-900 font-medium">{percent}%</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full">
                            <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No data yet.</p>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {showTrackingCode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-slate-900">Tracking Code</h2>
              <button onClick={() => setShowTrackingCode(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-1">Site: <span className="font-medium text-slate-900">{currentSite?.name}</span></p>
            <p className="text-sm text-slate-600 mb-4">Add this before your closing <code className="bg-slate-100 px-1 rounded">&lt;/head&gt;</code> tag:</p>
            <div className="bg-slate-900 rounded-lg p-4 mb-4">
              <code className="text-sm text-emerald-400 break-all">{currentTrackingCode}</code>
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(currentTrackingCode)}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-medium mb-2"
            >
              Copy to Clipboard
            </button>
            <button
              onClick={() => setShowTrackingCode(false)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-medium"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {showIpExclusions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-slate-900">IP Exclusions</h2>
              <button onClick={() => setShowIpExclusions(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Visits from these IP addresses won&apos;t be tracked for <span className="font-medium text-slate-900">{currentSite?.name}</span>. Useful for filtering out your own visits.
            </p>

            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 mb-4">
              <div>
                <p className="text-sm font-medium text-slate-900">Exclude listed IPs</p>
                <p className="text-xs text-slate-500">{ipExclusionEnabled ? 'On — matching visits are ignored' : 'Off — all visits are tracked'}</p>
              </div>
              <button
                onClick={() => setIpExclusionEnabled(!ipExclusionEnabled)}
                role="switch"
                aria-checked={ipExclusionEnabled}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${ipExclusionEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${ipExclusionEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="mb-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newIp}
                  onChange={(e) => { setNewIp(e.target.value); setIpError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addIp(newIp); } }}
                  placeholder="203.0.113.7 or 203.0.113.0/24"
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
                />
                <button onClick={() => addIp(newIp)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium">
                  Add
                </button>
              </div>
              {ipError && <p className="text-xs text-red-600 mt-1">{ipError}</p>}
              {myIp && !excludedIps.includes(myIp) && (
                <button onClick={() => addIp(myIp)} className="text-xs text-indigo-600 hover:text-indigo-800 mt-1.5">
                  + Add my current IP ({myIp})
                </button>
              )}
            </div>

            {excludedIps.length > 0 ? (
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 mb-4 max-h-48 overflow-y-auto">
                {excludedIps.map((ip) => (
                  <div key={ip} className="flex items-center justify-between px-3 py-2">
                    <span className="text-sm font-mono text-slate-700">{ip}</span>
                    <button
                      onClick={() => setExcludedIps(excludedIps.filter(i => i !== ip))}
                      title="Remove"
                      className="text-slate-400 hover:text-red-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center border border-dashed border-slate-200 rounded-lg py-4 mb-4">No excluded IPs yet</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowIpExclusions(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={saveIpExclusions}
                disabled={savingIps}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2 rounded-lg font-medium"
              >
                {savingIps ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm mx-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-900 text-center mb-2">Remove Site</h2>
            <p className="text-sm text-slate-600 text-center mb-1">
              Are you sure you want to remove <span className="font-medium text-slate-900">{currentSite?.name}</span>?
            </p>
            <p className="text-sm text-red-600 text-center mb-6">This will permanently delete all sessions, events, and data for this site.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={deleteSite}
                disabled={deletingSite}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2 rounded-lg font-medium"
              >
                {deletingSite ? 'Removing...' : 'Remove Site'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddSite && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Add New Site</h2>
            {trackingCode ? (
              <div>
                <p className="text-slate-600 mb-4">Add this code before your closing &lt;/head&gt; tag:</p>
                <div className="bg-slate-900 rounded-lg p-4 mb-4">
                  <code className="text-sm text-emerald-400 break-all">{trackingCode}</code>
                </div>
                <button onClick={() => navigator.clipboard.writeText(trackingCode)} className="w-full bg-slate-100 text-slate-700 py-2 rounded-lg font-medium mb-2">
                  Copy
                </button>
                <button onClick={() => { setShowAddSite(false); setTrackingCode(''); }} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium">
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={addSite}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Site Name</label>
                  <input
                    type="text"
                    value={newSiteName}
                    onChange={(e) => setNewSiteName(e.target.value)}
                    placeholder="My Website"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder:text-slate-400"
                    required
                  />
                </div>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Domain</label>
                  <input
                    type="text"
                    value={newSiteDomain}
                    onChange={(e) => setNewSiteDomain(e.target.value)}
                    placeholder="example.com"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder:text-slate-400"
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowAddSite(false)} className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-lg font-medium">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-medium">
                    Add Site
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
