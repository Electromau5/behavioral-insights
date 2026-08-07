'use client';

import { useState } from 'react';
import Link from 'next/link';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/flows', label: 'User Flows' },
  { href: '/friction', label: 'Patterns' },
  { href: '/journey', label: 'Journey Map' },
  { href: '/personas', label: 'Personas' },
];

interface NavSite {
  id: string;
  name: string;
}

interface AppNavProps {
  /** href of the current page, used to highlight the active nav item */
  active: string;
  /** optional site selector shown next to the logo */
  sites?: NavSite[];
  selectedSite?: string | null;
  onSelectSite?: (id: string) => void;
}

export default function AppNav({ active, sites, selectedSite, onSelectSite }: AppNavProps) {
  const [open, setOpen] = useState(false);
  const showSelect = sites && sites.length > 0 && onSelectSite;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <span className="font-semibold text-lg sm:text-xl text-slate-900 hidden sm:inline">Behavioral Insights</span>
            </Link>
            {showSelect && (
              <select
                value={selectedSite || ''}
                onChange={(e) => onSelectSite(e.target.value)}
                className="border border-slate-300 rounded-lg px-2 sm:px-3 py-1.5 text-sm bg-white text-slate-900 max-w-[45vw] sm:max-w-none truncate"
              >
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>{site.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-4 shrink-0">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={
                  active === item.href
                    ? 'text-indigo-600 font-medium text-sm whitespace-nowrap'
                    : 'text-slate-600 hover:text-slate-900 font-medium text-sm whitespace-nowrap'
                }
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Mobile toggle */}
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation menu"
            aria-expanded={open}
            className="md:hidden p-2 -mr-2 text-slate-600 hover:text-slate-900 shrink-0"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={open ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <nav className="md:hidden border-t border-slate-200 bg-white px-4 sm:px-6 py-2 flex flex-col">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`py-2.5 text-sm font-medium ${active === item.href ? 'text-indigo-600' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
