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
  siteCategory?: string | null;
  businessType?: string | null;
  targetAudience?: string | null;
  description?: string | null;
  relevantMetrics?: string[] | null;
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

const BUSINESS_TYPES: Record<string, string[]> = {
  business: [
    'E-commerce / Online Store',
    'SaaS / Software App',
    'Service Business',
    'Agency / Freelance',
    'Media / Blog / Publication',
    'Marketplace',
    'Non-profit',
  ],
  consumer: [
    'Designer Portfolio',
    'Developer Portfolio',
    'Creative Portfolio',
    'Personal Blog',
    'Personal Brand',
    'Event / Wedding Site',
    'Resume / CV',
  ],
};

const METRIC_OPTIONS = [
  { id: 'bounce_rate', label: 'Bounce Rate', desc: 'How many visitors leave after one page' },
  { id: 'session_duration', label: 'Session Duration', desc: 'How long visitors stay on average' },
  { id: 'page_views', label: 'Page Views', desc: 'Total pages viewed per session' },
  { id: 'scroll_depth', label: 'Scroll Depth', desc: 'How far visitors scroll down pages' },
  { id: 'top_pages', label: 'Top Pages', desc: 'Which pages get the most traffic' },
  { id: 'device_breakdown', label: 'Device Breakdown', desc: 'Mobile vs desktop usage' },
  { id: 'user_flows', label: 'User Flows', desc: 'Paths visitors take through your site' },
  { id: 'friction_points', label: 'Friction Points', desc: 'Where visitors get stuck or drop off' },
  { id: 'geographic', label: 'Geographic Distribution', desc: 'Where visitors come from' },
  { id: 'entry_exit', label: 'Entry & Exit Pages', desc: 'Where visitors start and leave' },
];

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
  const [showExcluded, setShowExcluded] = useState(false);

  // Report download
  const [downloadingReport, setDownloadingReport] = useState(false);

  const downloadReport = async () => {
    if (!selectedSite || downloadingReport) return;
    setDownloadingReport(true);
    try {
      const res = await fetch(`/api/report?siteId=${selectedSite}&period=${period}`);
      if (!res.ok) return;
      const filename = res.headers.get('x-filename') || 'report.md';
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
    setDownloadingReport(false);
  };

  // Export / import
  const [showDataModal, setShowDataModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ sites: number; sessions: number; events: number } | null>(null);
  const [importError, setImportError] = useState('');

  // Site profile modal
  const [showSiteProfile, setShowSiteProfile] = useState(false);
  const [profileStep, setProfileStep] = useState(1);
  const [profileCategory, setProfileCategory] = useState('');
  const [profileSiteType, setProfileSiteType] = useState('');
  const [profileTargetAudience, setProfileTargetAudience] = useState('');
  const [profileMetrics, setProfileMetrics] = useState<string[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => { fetchSites(); }, []);

  useEffect(() => {
    if (selectedSite) {
      fetchMetrics(selectedSite);
      fetchInsights(selectedSite);
    }
  }, [selectedSite, period, showExcluded]);

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
      const res = await fetch(`/api/metrics?siteId=${siteId}&period=${period}&includeExcluded=${showExcluded}`);
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

  const exportData = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/export');
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `behavioral-insights-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
    setExporting(false);
  };

  const importData = async (file: File) => {
    setImporting(true);
    setImportError('');
    setImportResult(null);
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backup),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setImportResult(data.imported);
      fetchSites();
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import failed');
    }
    setImporting(false);
  };

  const openSiteProfile = () => {
    const site = sites.find(s => s.id === selectedSite);
    setProfileCategory(site?.siteCategory || '');
    setProfileSiteType(site?.businessType || '');
    setProfileTargetAudience(site?.targetAudience || '');
    setProfileMetrics(site?.relevantMetrics || []);
    setProfileStep(1);
    setShowSiteProfile(true);
  };

  const saveSiteProfile = async () => {
    if (!selectedSite) return;
    setSavingProfile(true);
    try {
      const res = await fetch('/api/sites', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: selectedSite,
          siteCategory: profileCategory,
          businessType: profileSiteType,
          targetAudience: profileTargetAudience,
          relevantMetrics: profileMetrics,
        })
      });
      if (res.ok) {
        setSites(sites.map(s => s.id === selectedSite ? {
          ...s,
          siteCategory: profileCategory,
          businessType: profileSiteType,
          targetAudience: profileTargetAudience,
          relevantMetrics: profileMetrics,
        } : s));
        setShowSiteProfile(false);
      }
    } catch (e) { console.error(e); }
    setSavingProfile(false);
  };

  const toggleMetric = (id: string) => {
    setProfileMetrics(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const currentSite = sites.find(s => s.id === selectedSite);
  const siteProfileComplete = !!(currentSite?.siteCategory && currentSite?.businessType && currentSite?.targetAudience);

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
                  {/* Site profile */}
                  <button
                    onClick={openSiteProfile}
                    title="Site profile"
                    className={`p-1.5 rounded-lg border ${
                      siteProfileComplete
                        ? 'text-indigo-600 bg-indigo-50 border-indigo-300'
                        : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border-slate-300 hover:border-indigo-300'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </button>
                  {/* Tracking code */}
                  <button
                    onClick={() => setShowTrackingCode(true)}
                    title="View tracking code"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-300 hover:border-indigo-300"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                  </button>
                  {/* IP exclusions */}
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
                  {/* Delete */}
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    title="Remove site"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-300 hover:border-red-300"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                  {/* Download report */}
                  <button
                    onClick={downloadReport}
                    disabled={downloadingReport}
                    title="Download site report (.md)"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-300 hover:border-indigo-300 disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Link href="/flows" className="text-slate-600 hover:text-slate-900 font-medium text-sm whitespace-nowrap">User Flows</Link>
              <Link href="/friction" className="text-slate-600 hover:text-slate-900 font-medium text-sm whitespace-nowrap">Patterns</Link>
              <Link href="/journey" className="text-slate-600 hover:text-slate-900 font-medium text-sm whitespace-nowrap">Journey Map</Link>
              <Link href="/personas" className="text-slate-600 hover:text-slate-900 font-medium text-sm whitespace-nowrap">Personas</Link>
              <button onClick={() => setShowAddSite(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap">
                Add Site
              </button>

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
                      onClick={() => { setShowUserMenu(false); setShowDataModal(true); setImportResult(null); setImportError(''); }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Export / Import data
                    </button>
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
            {/* Site profile prompt when incomplete */}
            {!siteProfileComplete && (
              <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-indigo-900">Set up your site profile</p>
                  <p className="text-sm text-indigo-700 mt-0.5">Tell us about this site so AI insights are more relevant to your goals.</p>
                </div>
                <button
                  onClick={openSiteProfile}
                  className="ml-4 shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  Set up profile
                </button>
              </div>
            )}

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
                {currentSite?.ipExclusionEnabled && (
                  <label className="flex items-center gap-2 ml-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showExcluded}
                      onChange={(e) => setShowExcluded(e.target.checked)}
                      className="accent-indigo-600"
                    />
                    Show excluded traffic
                  </label>
                )}
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

      {/* ── Export / Import Modal ── */}
      {showDataModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-semibold text-slate-900">Export / Import data</h2>
              <button onClick={() => setShowDataModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Export */}
            <div className="border border-slate-200 rounded-xl p-4 mb-4">
              <h3 className="text-sm font-medium text-slate-900 mb-1">Export</h3>
              <p className="text-sm text-slate-500 mb-3">
                Download all your sites, sessions, events, and insights as a JSON backup file.
              </p>
              <button
                onClick={exportData}
                disabled={exporting}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {exporting ? 'Exporting...' : 'Download backup'}
              </button>
            </div>

            {/* Import */}
            <div className="border border-slate-200 rounded-xl p-4">
              <h3 className="text-sm font-medium text-slate-900 mb-1">Import</h3>
              <p className="text-sm text-slate-500 mb-3">
                Restore from a previously exported backup file. Existing records won&apos;t be overwritten — only missing data is added.
              </p>

              {importResult ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                  <p className="font-medium mb-1">Import complete</p>
                  <ul className="space-y-0.5 text-green-700">
                    <li>{importResult.sites} site{importResult.sites !== 1 ? 's' : ''}</li>
                    <li>{importResult.sessions} session{importResult.sessions !== 1 ? 's' : ''}</li>
                    <li>{importResult.events} event{importResult.events !== 1 ? 's' : ''}</li>
                  </ul>
                </div>
              ) : (
                <>
                  <label className={`w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-lg py-4 text-sm text-slate-600 hover:text-indigo-600 cursor-pointer transition-colors ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12" />
                    </svg>
                    {importing ? 'Importing...' : 'Choose backup file (.json)'}
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) importData(f); }}
                    />
                  </label>
                  {importError && <p className="text-xs text-red-600 mt-2">{importError}</p>}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Site Profile Modal ── */}
      {showSiteProfile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-100">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Site Profile</h2>
                  <p className="text-sm text-slate-500 mt-0.5">{currentSite?.name}</p>
                </div>
                <button onClick={() => setShowSiteProfile(false)} className="text-slate-400 hover:text-slate-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* Step indicator */}
              <div className="flex gap-1.5">
                {[1, 2, 3, 4].map((s) => (
                  <div
                    key={s}
                    className={`h-1 flex-1 rounded-full transition-colors ${s <= profileStep ? 'bg-indigo-600' : 'bg-slate-200'}`}
                  />
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-2">Step {profileStep} of 4</p>
            </div>

            {/* Step content */}
            <div className="px-6 py-5">
              {profileStep === 1 && (
                <div>
                  <p className="text-sm font-medium text-slate-900 mb-4">What kind of site is this?</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      {
                        value: 'business',
                        label: 'Business',
                        desc: 'A company, product, or service',
                        icon: (
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        ),
                      },
                      {
                        value: 'consumer',
                        label: 'Personal / Portfolio',
                        desc: 'A portfolio, blog, or personal project',
                        icon: (
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        ),
                      },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setProfileCategory(opt.value);
                          if (profileSiteType && !BUSINESS_TYPES[opt.value]?.includes(profileSiteType)) {
                            setProfileSiteType('');
                          }
                        }}
                        className={`flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left transition-colors ${
                          profileCategory === opt.value
                            ? 'border-indigo-600 bg-indigo-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <span className={profileCategory === opt.value ? 'text-indigo-600' : 'text-slate-500'}>
                          {opt.icon}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{opt.label}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {profileStep === 2 && (
                <div>
                  <p className="text-sm font-medium text-slate-900 mb-4">
                    What type of {profileCategory === 'business' ? 'business' : 'site'} is it?
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {(BUSINESS_TYPES[profileCategory] || []).map((type) => (
                      <button
                        key={type}
                        onClick={() => setProfileSiteType(type)}
                        className={`px-3 py-2.5 rounded-lg border text-sm text-left transition-colors ${
                          profileSiteType === type
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-medium'
                            : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {profileStep === 3 && (
                <div>
                  <p className="text-sm font-medium text-slate-900 mb-1">Who is your target audience?</p>
                  <p className="text-xs text-slate-500 mb-4">Describe who you&apos;re trying to reach — this helps AI insights stay relevant.</p>
                  <textarea
                    value={profileTargetAudience}
                    onChange={(e) => setProfileTargetAudience(e.target.value)}
                    rows={4}
                    placeholder={
                      profileCategory === 'consumer'
                        ? 'e.g. Hiring managers and creative directors looking for a senior UX designer'
                        : 'e.g. Small business owners aged 30–50 looking to automate invoicing'
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              )}

              {profileStep === 4 && (
                <div>
                  <p className="text-sm font-medium text-slate-900 mb-1">Which metrics matter most?</p>
                  <p className="text-xs text-slate-500 mb-4">Select the ones most relevant to your goals. You can change these anytime.</p>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {METRIC_OPTIONS.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => toggleMetric(m.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                          profileMetrics.includes(m.id)
                            ? 'border-indigo-600 bg-indigo-50'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                          profileMetrics.includes(m.id) ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                        }`}>
                          {profileMetrics.includes(m.id) && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{m.label}</p>
                          <p className="text-xs text-slate-500">{m.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer nav */}
            <div className="px-6 pb-6 flex gap-3">
              {profileStep > 1 ? (
                <button
                  onClick={() => setProfileStep(profileStep - 1)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-medium text-sm"
                >
                  Back
                </button>
              ) : (
                <button
                  onClick={() => setShowSiteProfile(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-medium text-sm"
                >
                  Cancel
                </button>
              )}
              {profileStep < 4 ? (
                <button
                  onClick={() => setProfileStep(profileStep + 1)}
                  disabled={
                    (profileStep === 1 && !profileCategory) ||
                    (profileStep === 2 && !profileSiteType)
                  }
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white py-2 rounded-lg font-medium text-sm"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={saveSiteProfile}
                  disabled={savingProfile}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2 rounded-lg font-medium text-sm"
                >
                  {savingProfile ? 'Saving...' : 'Save profile'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Tracking Code Modal ── */}
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

      {/* ── IP Exclusions Modal ── */}
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
              Visits from these IP addresses are tagged as excluded for <span className="font-medium text-slate-900">{currentSite?.name}</span> and hidden from analytics. Use &quot;Show excluded traffic&quot; on the dashboard to reveal them anytime.
            </p>

            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 mb-4">
              <div>
                <p className="text-sm font-medium text-slate-900">Exclude listed IPs</p>
                <p className="text-xs text-slate-500">{ipExclusionEnabled ? 'On — matching visits are tagged and hidden' : 'Off — all visits are tracked normally'}</p>
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

      {/* ── Delete Confirm Modal ── */}
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

      {/* ── Add Site Modal ── */}
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
                <button
                  onClick={() => {
                    setShowAddSite(false);
                    setTrackingCode('');
                    openSiteProfile();
                  }}
                  className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium mb-2"
                >
                  Set up site profile
                </button>
                <button
                  onClick={() => { setShowAddSite(false); setTrackingCode(''); }}
                  className="w-full text-sm text-slate-500 hover:text-slate-700 py-1"
                >
                  Skip for now
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
