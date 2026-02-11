import Link from 'next/link';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function Home() {
  const session = await auth();

  if (session) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <span className="font-semibold text-xl text-slate-900">Behavioral Insights</span>
            </Link>
            <div className="flex items-center gap-4">
              {session ? (
                <>
                  <Link href="/dashboard" className="text-slate-600 hover:text-slate-900 font-medium">Dashboard</Link>
                  <Link href="/dashboard" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium">Go to App</Link>
                </>
              ) : (
                <>
                  <Link href="/login" className="text-slate-600 hover:text-slate-900 font-medium">Sign in</Link>
                  <Link href="/register" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium">Get Started</Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center">
          <h1 className="text-5xl sm:text-6xl font-bold text-slate-900 tracking-tight">
            Understand Your Users
            <br />
            <span className="text-indigo-600">Like Never Before</span>
          </h1>
          <p className="mt-6 text-xl text-slate-600 max-w-2xl mx-auto">
            AI-powered analytics that tells you not just what users do, but why they do it. 
            Get natural language insights and anomaly detection without complex dashboards.
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <Link href={session ? "/dashboard" : "/register"} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg font-semibold text-lg shadow-lg shadow-indigo-600/20">
              {session ? "Go to Dashboard" : "Start Free Trial"}
            </Link>
            <Link href="#features" className="bg-white hover:bg-slate-50 text-slate-700 px-8 py-3 rounded-lg font-semibold text-lg border border-slate-300">
              Learn More
            </Link>
          </div>
        </div>
      </section>

      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">
          Everything You Need to Understand User Behavior
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Natural Language Insights</h3>
            <p className="text-slate-600">Get clear, actionable insights written in plain English. No more deciphering complex charts.</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">User Psychology Analysis</h3>
            <p className="text-slate-600">Understand user intent, mindset, and whether they found what they were looking for.</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">User Flow Tracking</h3>
            <p className="text-slate-600">See the complete journey of every user from entry to exit with detailed event timelines.</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Friction Detection</h3>
            <p className="text-slate-600">Automatically identify where users struggle, backtrack, or abandon their journey.</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Simple Integration</h3>
            <p className="text-slate-600">Add a single line of code to your website. We handle tracking, storage, and analysis.</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Privacy Focused</h3>
            <p className="text-slate-600">No personal data collection. Focus on behavior patterns, not individual identity.</p>
          </div>
        </div>
      </section>

      <section className="bg-indigo-600 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to understand your users?</h2>
          <p className="text-indigo-100 text-lg mb-8 max-w-2xl mx-auto">
            Join hundreds of companies using Behavioral Insights to improve their user experience.
          </p>
          <Link href={session ? "/dashboard" : "/register"} className="bg-white hover:bg-slate-100 text-indigo-600 px-8 py-3 rounded-lg font-semibold text-lg inline-block">
            {session ? "Go to Dashboard" : "Get Started Free"}
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-slate-900">Behavioral Insights</span>
            <p className="text-slate-500 text-sm">© 2024 Behavioral Insights. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
