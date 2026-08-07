'use client';

import { useState, useEffect } from 'react';
import AppNav from '@/components/AppNav';

interface Site {
  id: string;
  name: string;
  domain: string;
}

interface Persona {
  id: string;
  name: string;
  archetype: string;
  tagline: string;
  emoji: string;
  prevalence: number;
  primaryDevice: string;
  topLocations: string[];
  primarySource: string;
  avgDurationSeconds: number;
  avgPageViews: number;
  typicalEntryPage: string;
  typicalExitPage: string;
  goals: string[];
  behaviors: string[];
  frustrations: string[];
  motivations: string;
  quote: string;
}

interface PersonaRecord {
  id: string;
  siteId: string;
  period: string;
  data: { personas: Persona[]; summary: string };
  generatedAt: string;
}

const COLORS = [
  {
    strip: 'bg-indigo-500',
    badge: 'bg-indigo-100 text-indigo-700',
    goalTag: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    bar: 'bg-indigo-500',
    barBg: 'bg-indigo-100',
    quote: 'border-indigo-300',
  },
  {
    strip: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700',
    goalTag: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    bar: 'bg-emerald-500',
    barBg: 'bg-emerald-100',
    quote: 'border-emerald-300',
  },
  {
    strip: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-700',
    goalTag: 'bg-amber-50 text-amber-700 border border-amber-200',
    bar: 'bg-amber-500',
    barBg: 'bg-amber-100',
    quote: 'border-amber-300',
  },
  {
    strip: 'bg-rose-500',
    badge: 'bg-rose-100 text-rose-700',
    goalTag: 'bg-rose-50 text-rose-700 border border-rose-200',
    bar: 'bg-rose-500',
    barBg: 'bg-rose-100',
    quote: 'border-rose-300',
  },
];

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function DeviceIcon({ device }: { device: string }) {
  if (device === 'mobile') return <span title="Mobile">📱</span>;
  if (device === 'tablet') return <span title="Tablet">📟</span>;
  return <span title="Desktop">💻</span>;
}

function PersonaCard({ persona, index }: { persona: Persona; index: number }) {
  const c = COLORS[index % COLORS.length];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
      {/* Color strip */}
      <div className={`h-1.5 w-full ${c.strip}`} />

      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <span className="text-4xl leading-none">{persona.emoji}</span>
            <div>
              <h3 className="text-lg font-bold text-slate-900 leading-tight">{persona.name}</h3>
              <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.badge}`}>
                {persona.archetype}
              </span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-2xl font-bold text-slate-800">{persona.prevalence}%</span>
            <p className="text-xs text-slate-500">of visitors</p>
          </div>
        </div>

        {/* Prevalence bar */}
        <div className={`w-full h-1.5 rounded-full ${c.barBg} mb-4`}>
          <div
            className={`h-1.5 rounded-full ${c.bar} transition-all`}
            style={{ width: `${Math.min(persona.prevalence, 100)}%` }}
          />
        </div>

        {/* Tagline */}
        <p className="text-sm text-slate-500 italic">{persona.tagline}</p>
      </div>

      {/* Quote */}
      <div className={`mx-6 mb-5 pl-4 border-l-2 ${c.quote}`}>
        <p className="text-sm text-slate-700 italic">&ldquo;{persona.quote}&rdquo;</p>
      </div>

      {/* Stats row */}
      <div className="px-6 mb-5 grid grid-cols-3 gap-3">
        <div className="bg-slate-50 rounded-xl p-3 text-center">
          <div className="text-lg mb-0.5"><DeviceIcon device={persona.primaryDevice} /></div>
          <p className="text-xs font-medium text-slate-700 capitalize">{persona.primaryDevice}</p>
          <p className="text-xs text-slate-400">device</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 text-center">
          <p className="text-base font-bold text-slate-800">{formatDuration(persona.avgDurationSeconds)}</p>
          <p className="text-xs text-slate-400">avg time</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 text-center">
          <p className="text-base font-bold text-slate-800">{persona.avgPageViews}</p>
          <p className="text-xs text-slate-400">pages/visit</p>
        </div>
      </div>

      {/* Typical path */}
      <div className="px-6 mb-5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Typical path</p>
        <div className="flex items-center gap-2 text-sm">
          <span className="px-2 py-1 bg-slate-100 rounded-lg text-slate-700 font-mono text-xs truncate max-w-[120px]">
            {persona.typicalEntryPage || '/'}
          </span>
          <span className="text-slate-400">→</span>
          <span className="px-2 py-1 bg-slate-100 rounded-lg text-slate-700 font-mono text-xs truncate max-w-[120px]">
            {persona.typicalExitPage || '/'}
          </span>
        </div>
        {persona.topLocations.length > 0 && (
          <p className="text-xs text-slate-400 mt-2">
            📍 {persona.topLocations.slice(0, 2).join(', ')} · {persona.primarySource}
          </p>
        )}
      </div>

      <div className="border-t border-slate-100 mx-6 mb-5" />

      {/* Goals */}
      <div className="px-6 mb-5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Goals</p>
        <div className="flex flex-wrap gap-2">
          {persona.goals.map((goal, i) => (
            <span key={i} className={`text-xs px-2.5 py-1 rounded-full font-medium ${c.goalTag}`}>
              {goal}
            </span>
          ))}
        </div>
      </div>

      {/* Behaviors */}
      <div className="px-6 mb-5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Behaviors</p>
        <ul className="space-y-1.5">
          {persona.behaviors.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
              {b}
            </li>
          ))}
        </ul>
      </div>

      {/* Frustrations */}
      {persona.frustrations.length > 0 && (
        <div className="px-6 mb-6">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Frustrations</p>
          <div className="flex flex-wrap gap-2">
            {persona.frustrations.map((f, i) => (
              <span key={i} className="text-xs px-2.5 py-1 rounded-full font-medium bg-red-50 text-red-700 border border-red-200">
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Motivations */}
      <div className="px-6 pb-6 mt-auto">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Motivation</p>
        <p className="text-sm text-slate-600">{persona.motivations}</p>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-pulse">
      <div className="h-1.5 w-full bg-slate-200" />
      <div className="p-6 space-y-3">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-200" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-200 rounded w-2/3" />
            <div className="h-3 bg-slate-200 rounded w-1/3" />
          </div>
        </div>
        <div className="h-2 bg-slate-200 rounded-full" />
        <div className="h-3 bg-slate-200 rounded w-4/5" />
        <div className="grid grid-cols-3 gap-2 pt-2">
          {[0, 1, 2].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl" />)}
        </div>
        <div className="space-y-2 pt-2">
          <div className="h-3 bg-slate-200 rounded w-1/4" />
          <div className="h-3 bg-slate-200 rounded w-3/4" />
          <div className="h-3 bg-slate-200 rounded w-2/3" />
        </div>
      </div>
    </div>
  );
}

export default function PersonasPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  const [period, setPeriod] = useState('30d');
  const [record, setRecord] = useState<PersonaRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { fetchSites(); }, []);
  useEffect(() => { if (selectedSite) fetchPersonas(); }, [selectedSite, period]);

  async function fetchSites() {
    try {
      const res = await fetch('/api/sites');
      if (!res.ok) return;
      const data = await res.json();
      const list = data.sites || [];
      setSites(list);
      if (list.length > 0) setSelectedSite(list[0].id);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function fetchPersonas() {
    if (!selectedSite) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/personas?siteId=${selectedSite}&period=${period}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setRecord(data.personas || null);
    } catch {
      setError('Failed to load personas.');
    } finally {
      setLoading(false);
    }
  }

  async function generatePersonas() {
    if (!selectedSite) return;
    setGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/personas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: selectedSite, period }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setRecord(data.personas);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  const personaList: Persona[] = (record?.data?.personas) || [];
  const summary: string = record?.data?.summary || '';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <AppNav active="/personas" />

      {/* Toolbar */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-slate-900">User Personas</h1>
            <select
              value={selectedSite || ''}
              onChange={e => setSelectedSite(e.target.value)}
              className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {sites.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-slate-300 overflow-hidden">
              {(['7d', '30d', '90d'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 text-sm font-medium ${period === p ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  {p === '7d' ? '7 days' : p === '30d' ? '30 days' : '90 days'}
                </button>
              ))}
            </div>
            <button
              onClick={generatePersonas}
              disabled={generating || !selectedSite}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? 'Generating…' : record ? 'Regenerate' : 'Generate Personas'}
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Generating skeletons */}
        {generating && (
          <div>
            <div className="h-4 bg-slate-200 rounded w-2/3 mb-8 animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </div>
        )}

        {/* Empty state */}
        {!generating && !loading && !record && !error && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="text-6xl mb-4">👥</div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Generate your first personas</h2>
            <p className="text-slate-500 max-w-md mb-8">
              Behavioral data is analyzed to identify distinct visitor types — who they are, what they want, and where they get stuck.
            </p>
            <button
              onClick={generatePersonas}
              disabled={!selectedSite}
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              Generate Personas
            </button>
          </div>
        )}

        {/* Personas display */}
        {!generating && record && personaList.length > 0 && (
          <div>
            {/* Meta row */}
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-slate-500">
                Generated {new Date(record.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                {' · '}{personaList.length} personas
              </p>
            </div>

            {/* Summary */}
            {summary && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-6 py-5 mb-8">
                <p className="text-sm font-semibold text-indigo-700 mb-1">Audience overview</p>
                <p className="text-slate-700 text-sm leading-relaxed">{summary}</p>
              </div>
            )}

            {/* Persona cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {personaList.map((persona, i) => (
                <PersonaCard key={persona.id} persona={persona} index={i} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
